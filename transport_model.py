"""Public transport access model for livability scores.

Builds a rail network from LTA station codes and station-exit locations, and a
bus network from busrouter.sg's stop/route data (LTA DataMall data republished
as open JSON). For any location it estimates:

  - minutes to the fastest-reached MRT/LRT station, walking or by bus
  - rail lines reachable within 15 minutes (LRT lines count half)
  - minutes to the nearest interchange (2+ MRT lines)
  - distinct bus services within a 400 m walk
  - a door-to-Raffles-Place commute time over the rail network

All times are modelled from fixed walking, bus and train speeds, waits and
transfer penalties. They're consistent estimates for comparing blocks, not
timetabled journey plans.
"""

import csv
import heapq
import json
import pathlib
import re
from collections import defaultdict

from geo import PointIndex, distance_m

WALK_M_PER_MIN = 80
WALK_DETOUR = 1.3
BUS_KMH = 19
BUS_DETOUR = 1.25
BUS_DWELL_MIN = 0.4
MAX_BOARD_WALK_M = 500
STOP_TO_EXIT_M = 300
MAX_RIDE_STOPS = 25
MAX_RIDE_MIN = 30
NEARBY_SERVICES_M = 400
MAX_DIRECT_WALK_M = 2500
TRAIN_WAIT_MIN = 3
TRANSFER_MIN = 4
CBD_EGRESS_MIN = 2
CBD_STATION = "RAFFLES PLACE"
CBD_POINT = (1.2840, 103.8514)
LINES_WINDOW_MIN = 15
MAX_LISTED_STATIONS = 4
SPEED = {"mrt": (45, 0.4), "lrt": (28, 0.3)}  # km/h, dwell minutes per station

LINE_GROUPS = {
    "NS": "NSL", "EW": "EWL", "CG": "EWL", "NE": "NEL", "CC": "CCL", "CE": "CCL", "DT": "DTL", "TE": "TEL",
    "BP": "BPLRT", "SE": "SKLRT", "SW": "SKLRT", "STC": "SKLRT", "PE": "PGLRT", "PW": "PGLRT", "PTC": "PGLRT",
}
LRT_GROUPS = {"BPLRT", "SKLRT", "PGLRT"}
LINE_LABELS = {
    "NSL": "North-South", "EWL": "East-West", "NEL": "North East", "CCL": "Circle", "DTL": "Downtown",
    "TEL": "Thomson-East Coast", "BPLRT": "Bukit Panjang LRT", "SKLRT": "Sengkang LRT", "PGLRT": "Punggol LRT",
}

# LTA's station-code dataset (last updated Jun 2024) predates TEL stages and
# Punggol Coast. Codes here are only used if the station appears in the newer
# exits dataset, so unopened stations are skipped automatically.
SUPPLEMENTAL_CODES = [
    ("TE1", "Woodlands North"), ("TE2", "Woodlands"), ("TE3", "Woodlands South"), ("TE4", "Springleaf"),
    ("TE5", "Lentor"), ("TE6", "Mayflower"), ("TE7", "Bright Hill"), ("TE8", "Upper Thomson"),
    ("TE9", "Caldecott"), ("TE10", "Mount Pleasant"), ("TE11", "Stevens"), ("TE12", "Napier"),
    ("TE13", "Orchard Boulevard"), ("TE14", "Orchard"), ("TE15", "Great World"), ("TE16", "Havelock"),
    ("TE17", "Outram Park"), ("TE18", "Maxwell"), ("TE19", "Shenton Way"), ("TE20", "Marina Bay"),
    ("TE21", "Marina South"), ("TE22", "Gardens by the Bay"), ("TE23", "Tanjong Rhu"), ("TE24", "Katong Park"),
    ("TE25", "Tanjong Katong"), ("TE26", "Marine Parade"), ("TE27", "Marine Terrace"), ("TE28", "Siglap"),
    ("TE29", "Bayshore"), ("TE30", "Bedok South"), ("TE31", "Sungei Bedok"), ("NE18", "Punggol Coast"),
    ("CC30", "Keppel"), ("CC31", "Cantonment"), ("CC32", "Prince Edward Road"),
    ("NS12", "Canberra"), ("DT4", "Hume"),
]
# Links that consecutive code numbering doesn't capture (branches, LRT loops).
EXTRA_LINKS = [
    ("CG1", "EW4"), ("CE1", "CC4"), ("BP13", "BP6"),
    ("SE1", "STC"), ("SE5", "STC"), ("SW1", "STC"), ("SW8", "STC"),
    ("PE1", "PTC"), ("PE7", "PTC"), ("PW1", "PTC"), ("PW7", "PTC"),
]
NIGHT_SERVICE = re.compile(r"^(NR\d+|\d+N)$")


def walk_min(meters: float) -> float:
    return meters * WALK_DETOUR / WALK_M_PER_MIN


def bus_wait_min(services_at_stop: int) -> float:
    # More services at a stop means a shorter wait for one heading the right way.
    return max(2.5, 7 - 0.5 * services_at_stop)


def normalize_station(name: str) -> str:
    name = re.sub(r"\s+(MRT|LRT)\s+STATION$", "", name.strip().upper())
    return re.sub(r"\s+", " ", name.replace("’", "'"))


def code_parts(code: str) -> tuple[str, int]:
    match = re.match(r"^([A-Z]+)(\d*)", code)
    return match.group(1), int(match.group(2) or 0)


class TransportModel:
    def __init__(self, exits_geojson: pathlib.Path, station_codes_csv: pathlib.Path, bus_stops_json: pathlib.Path,
                 bus_services_json: pathlib.Path):
        self._load_rail(exits_geojson, station_codes_csv)
        self._load_bus(bus_stops_json, bus_services_json)

    # ----- rail -----

    def _load_rail(self, exits_geojson, station_codes_csv) -> None:
        exits = defaultdict(list)
        for f in json.loads(exits_geojson.read_text(encoding="utf-8"))["features"]:
            lon, lat = f["geometry"]["coordinates"][:2]
            props = f["properties"]
            exits[normalize_station(props["STATION_NA"])].append((float(lat), float(lon), props.get("EXIT_CODE", "").strip()))
        # Payload is (station, exit code).
        self.exit_index = PointIndex([(lat, lon, (name, code)) for name, pts in exits.items() for lat, lon, code in pts])
        self.station_coord = {
            name: (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)) for name, pts in exits.items()
        }

        with station_codes_csv.open(encoding="utf-8-sig", newline="") as f:
            codes = [(r["stn_code"].strip(), r["mrt_station_english"].strip()) for r in csv.DictReader(f)]
        known = {c for c, _ in codes}
        codes += [(c, n) for c, n in SUPPLEMENTAL_CODES if c not in known]

        self.code_station = {}
        for code, name in codes:
            station = normalize_station(name)
            prefix, _ = code_parts(code)
            if station in self.station_coord and prefix in LINE_GROUPS:
                self.code_station[code] = station
        self.unmatched_exit_stations = sorted(set(self.station_coord) - set(self.code_station.values()))

        self.station_lines = defaultdict(set)
        for code, station in self.code_station.items():
            self.station_lines[station].add(LINE_GROUPS[code_parts(code)[0]])

        graph = defaultdict(list)

        def link(code_a: str, code_b: str) -> None:
            a, b = self.code_station.get(code_a), self.code_station.get(code_b)
            group = LINE_GROUPS[code_parts(code_a)[0]]
            if not a or not b or a == b or LINE_GROUPS[code_parts(code_b)[0]] != group:
                return
            kmh, dwell = SPEED["lrt" if group in LRT_GROUPS else "mrt"]
            minutes = distance_m(*self.station_coord[a], *self.station_coord[b]) / 1000 / kmh * 60 + dwell
            graph[(a, group)].append(((b, group), minutes))
            graph[(b, group)].append(((a, group), minutes))

        by_prefix = defaultdict(list)
        for code in self.code_station:
            by_prefix[code_parts(code)[0]].append(code)
        for prefix, prefix_codes in by_prefix.items():
            ordered = sorted(prefix_codes, key=lambda c: code_parts(c)[1])
            for a, b in zip(ordered, ordered[1:]):
                link(a, b)
        for a, b in EXTRA_LINKS:
            link(a, b)
        for station, groups in self.station_lines.items():
            for g1 in groups:
                for g2 in groups:
                    if g1 != g2:
                        graph[(station, g1)].append(((station, g2), TRANSFER_MIN))

        self.graph = graph
        self.rail_to_cbd = self._rail_minutes_to({CBD_STATION})
        self.interchanges = {s for s in self.station_lines if self.mrt_line_count(s) >= 2}
        self.rail_to_interchange = self._rail_minutes_to(self.interchanges)

    def _rail_minutes_to(self, targets: set[str]) -> dict[str, float]:
        """Minutes by train from every station to the nearest target station (multi-source Dijkstra)."""
        dist = {}
        heap = [(0.0, (s, g)) for s in targets for g in self.station_lines.get(s, ())]
        while heap:
            d, node = heapq.heappop(heap)
            if node in dist:
                continue
            dist[node] = d
            for nxt, w in self.graph[node]:
                if nxt not in dist:
                    heapq.heappush(heap, (d + w, nxt))
        by_station = {}
        for (station, _), d in dist.items():
            by_station[station] = min(d, by_station.get(station, d))
        return by_station

    def mrt_line_count(self, station: str) -> int:
        return len(self.station_lines[station] - LRT_GROUPS)

    @staticmethod
    def _via_rail(access_min: float, rail_min: float) -> float:
        return access_min + (TRAIN_WAIT_MIN + rail_min if rail_min > 0 else 0)

    # ----- bus -----

    def _load_bus(self, bus_stops_json, bus_services_json) -> None:
        raw_stops = json.loads(bus_stops_json.read_text(encoding="utf-8"))
        self.stops = {code: (float(v[1]), float(v[0]), v[2]) for code, v in raw_stops.items()}
        self.stop_index = PointIndex([(lat, lon, code) for code, (lat, lon, _) in self.stops.items()])
        services = {
            no: svc for no, svc in json.loads(bus_services_json.read_text(encoding="utf-8")).items()
            if not NIGHT_SERVICE.match(no)
        }

        self.stop_services = defaultdict(set)
        for no, svc in services.items():
            for route in svc["routes"]:
                for code in route:
                    self.stop_services[code].add(no)

        stop_exits = {}
        for code, (lat, lon, _) in self.stops.items():
            near = {}
            for d, (station, _) in self.exit_index.within(lat, lon, STOP_TO_EXIT_M):
                near[station] = min(walk_min(d), near.get(station, 99))
            if near:
                stop_exits[code] = near

        # stop -> station -> (minutes riding + walking to the exit, service)
        self.stop_to_station = defaultdict(dict)
        for no, svc in services.items():
            for route in svc["routes"]:
                route = [c for c in route if c in self.stops]
                for i, board in enumerate(route):
                    ride = 0.0
                    for j in range(i + 1, min(len(route), i + 1 + MAX_RIDE_STOPS)):
                        a, b = self.stops[route[j - 1]], self.stops[route[j]]
                        ride += distance_m(a[0], a[1], b[0], b[1]) * BUS_DETOUR / 1000 / BUS_KMH * 60 + BUS_DWELL_MIN
                        if ride > MAX_RIDE_MIN:
                            break
                        for station, egress in stop_exits.get(route[j], {}).items():
                            total = ride + egress
                            best = self.stop_to_station[board].get(station)
                            if best is None or total < best[0]:
                                self.stop_to_station[board][station] = (total, no)

    # ----- per-location access -----

    def access(self, lat: float, lon: float) -> dict:
        best = {}  # station -> (minutes, how, exit code, walk metres) — exit/metres only when walking

        def offer(station: str, minutes: float, how: str, exit_code: str | None = None, meters: float | None = None) -> None:
            if station not in best or minutes < best[station][0]:
                best[station] = (minutes, how, exit_code, meters)

        for d, (station, exit_code) in self.exit_index.within(lat, lon, MAX_DIRECT_WALK_M):
            offer(station, walk_min(d), "walk", exit_code, d)

        board_stops = self.stop_index.within(lat, lon, MAX_BOARD_WALK_M)
        for d, code in board_stops:
            to_stop = walk_min(d) + bus_wait_min(len(self.stop_services.get(code, ())))
            for station, (ride, service) in self.stop_to_station.get(code, {}).items():
                offer(station, to_stop + ride, f"bus {service}")

        if not best:
            station_d, (station, exit_code) = self.exit_index.nearest(lat, lon)
            offer(station, walk_min(station_d), "walk", exit_code, station_d)

        ranked = sorted(best.items(), key=lambda kv: kv[1][0])
        rail_station, (rail_min, rail_how, _, _) = ranked[0]
        reachable = {s for s, (m, *_) in best.items() if m <= LINES_WINDOW_MIN}
        lines = set().union(*(self.station_lines[s] for s in reachable)) if reachable else set()
        # Stations within the window for display; always at least the fastest one.
        nearby_stations = [
            {
                "station": s,
                "min": round(m, 1),
                "how": how,
                "lines": ",".join(sorted(self.station_lines[s])),
                "exit": exit_code if how == "walk" else None,
                "walk_m": round(meters) if how == "walk" and meters is not None else None,
                "lon": round(self.station_coord[s][1], 5),
            }
            for s, (m, how, exit_code, meters) in ranked
            if m <= LINES_WINDOW_MIN
        ][:MAX_LISTED_STATIONS] or [
            {"station": rail_station, "min": round(rail_min, 1), "how": rail_how,
             "lines": ",".join(sorted(self.station_lines[rail_station])), "exit": None, "walk_m": None,
             "lon": round(self.station_coord[rail_station][1], 5)}
        ]

        interchange_options = [
            (self._via_rail(m, self.rail_to_interchange[s]), s) for s, (m, *_) in best.items() if s in self.rail_to_interchange
        ]
        interchange_min, interchange_via = min(interchange_options) if interchange_options else (None, None)

        cbd_options = [
            (self._via_rail(m, self.rail_to_cbd[s]) + CBD_EGRESS_MIN, s) for s, (m, *_) in best.items() if s in self.rail_to_cbd
        ]
        cbd_options.append((walk_min(distance_m(lat, lon, *CBD_POINT)), "walk"))
        cbd_min, cbd_via = min(cbd_options)

        nearby_services = set()
        for d, code in board_stops:
            if d <= NEARBY_SERVICES_M:
                nearby_services |= self.stop_services.get(code, set())

        return {
            "rail_min": round(rail_min, 1),
            "rail_station": rail_station,
            "rail_how": rail_how,
            "rail_station_lines": ",".join(sorted(self.station_lines[rail_station])),
            "lines_15min": sum(0.5 if g in LRT_GROUPS else 1 for g in lines),
            "lines_15min_list": ",".join(sorted(lines)),
            "interchange_min": round(interchange_min, 1) if interchange_min is not None else None,
            "interchange_via": interchange_via,
            "bus_services_400m": len(nearby_services),
            "cbd_min": round(cbd_min, 1),
            "cbd_via": cbd_via,
            "stations_15min": json.dumps(nearby_stations),
        }
