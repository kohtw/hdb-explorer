"""Distance helpers and a grid spatial index for Singapore-scale point lookups."""

import math
from collections import defaultdict

M_PER_DEG_LAT = 110_574
M_PER_DEG_LON = 111_320 * math.cos(math.radians(1.35))


def distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    # Equirectangular approximation; error is negligible across Singapore.
    return math.hypot((lat2 - lat1) * M_PER_DEG_LAT, (lon2 - lon1) * M_PER_DEG_LON)


class PointIndex:
    """Grid index of (lat, lon, payload) points for radius queries and nearest lookups."""

    CELL_DEG = 0.01
    CELL_M = CELL_DEG * min(M_PER_DEG_LAT, M_PER_DEG_LON)

    def __init__(self, points: list[tuple]):
        self.points = points
        self.cells = defaultdict(list)
        for p in points:
            self.cells[self._cell(p[0], p[1])].append(p)

    def _cell(self, lat: float, lon: float) -> tuple[int, int]:
        return int(lat // self.CELL_DEG), int(lon // self.CELL_DEG)

    def _ring(self, cy: int, cx: int, k: int):
        for y in range(cy - k, cy + k + 1):
            for x in range(cx - k, cx + k + 1):
                if max(abs(y - cy), abs(x - cx)) == k:
                    yield from self.cells.get((y, x), ())

    def within(self, lat: float, lon: float, radius_m: float) -> list[tuple[float, object]]:
        """(distance_m, payload) for every point within radius_m."""
        cy, cx = self._cell(lat, lon)
        found = []
        for k in range(math.ceil(radius_m / self.CELL_M) + 1):
            for p in self._ring(cy, cx, k):
                d = distance_m(lat, lon, p[0], p[1])
                if d <= radius_m:
                    found.append((d, p[2]))
        return found

    def nearest(self, lat: float, lon: float) -> tuple[float, object]:
        cy, cx = self._cell(lat, lon)
        best = (math.inf, None)
        for k in range(60):
            for p in self._ring(cy, cx, k):
                d = distance_m(lat, lon, p[0], p[1])
                if d < best[0]:
                    best = (d, p[2])
            # Every point within k cells' distance has now been checked.
            if best[0] <= k * self.CELL_M:
                return best
        return best
