import math


def _plane_height(plane, x, z):
    return max(0, plane['a'] * x + plane['b'] * z + plane['c'])


def height(data, x, z):
    points = data['points']
    plane = data['fallbackPlane']
    for i, j, k in data['triangles']:
        a, b, c = points[i], points[j], points[k]
        area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
        wb = ((x - a[0]) * (c[1] - a[1]) - (z - a[1]) * (c[0] - a[0])) / area
        wc = ((b[0] - a[0]) * (z - a[1]) - (b[1] - a[1]) * (x - a[0])) / area
        wa = 1 - wb - wc
        if wa >= -1e-10 and wb >= -1e-10 and wc >= -1e-10:
            return wa * a[2] + wb * b[2] + wc * c[2]

    distance, residual = math.inf, 0
    for i, j in data['hullEdges']:
        a, b = points[i], points[j]
        dx, dz = b[0] - a[0], b[1] - a[1]
        t = max(0, min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)))
        px, pz = a[0] + t * dx, a[1] + t * dz
        candidate = math.hypot(x - px, z - pz)
        if candidate < distance:
            distance = candidate
            residual = a[2] + t * (b[2] - a[2]) - _plane_height(plane, px, pz)
    return _plane_height(plane, x, z) + residual * math.exp(-distance / data['extrapolationBlend'])
