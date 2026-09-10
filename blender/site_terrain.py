"""Sample the shared site grading recipe in east/south plan coordinates."""
import math
if __package__:
    from .survey_surface import height as survey_height
else:
    from survey_surface import height as survey_height


def smoothstep(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3.0 - 2.0 * t)


def rect_distance(rect, x, y):
    return math.hypot(max(rect["x0"] - x, 0, x - rect["x1"]),
                      max(rect["z0"] - y, 0, y - rect["z1"]))


def polygon_distance(points, x, y):
    inside, distance = False, math.inf
    for i, b in enumerate(points):
        a = points[i - 1]
        dx, dy = b[0] - a[0], b[1] - a[1]
        if (a[1] > y) != (b[1] > y) and x < dx * (y - a[1]) / dy + a[0]:
            inside = not inside
        t = max(0, min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)))
        distance = min(distance, math.hypot(x - a[0] - t * dx, y - a[1] - t * dy))
    return 0 if inside else distance


def route_sample(route, x, y, bank=False):
    samples = []
    for i in range(1, len(route['points'])):
        a, b = route['points'][i - 1], route['points'][i]
        dx, dy = b[0] - a[0], b[1] - a[1]
        t = max(0, min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)))
        d = math.hypot(x - a[0] - t * dx, y - a[1] - t * dy)
        samples.append((d, route['levels'][i - 1] + (route['levels'][i] - route['levels'][i - 1]) * t))
    distance = min(sample[0] for sample in samples)
    weighted, total, bank_weighted, bank_total = 0, 0, 0, 0
    for d, value in samples:
        weight = smoothstep(1 - (d - distance) / (2 if route.get('approachBank') else .2))/(d*d+1e-12)
        weighted += value * weight
        total += weight
        if bank and route.get('approachBank'):
            bank_weight = 1/(d*d+1e-12)
            bank_weighted += value * bank_weight
            bank_total += bank_weight
    level = weighted / total
    if bank_total:
        level += (bank_weighted/bank_total-level)*smoothstep((distance-route['width']/2)/.3)
    if route.get('endCircle'):
        circle = route['endCircle']
        d = max(0, math.hypot(x-circle['cx'], y-circle['cz'])-circle['radius'])
        level = route['levels'][-1]+(level-route['levels'][-1])*smoothstep(d/.6)
    if route.get('startRect'):
        d = rect_distance(route['startRect'], x, y)
        level = route['levels'][0]+(level-route['levels'][0])*smoothstep(d/.6)
    return distance, level


def route_bedding(route, x, y):
    if 'startBedding' not in route:
        return route.get('bedding', .04)
    a, b = route['points'][:2]
    dx, dy = b[0]-a[0], b[1]-a[1]
    distance = ((x-a[0])*dx+(y-a[1])*dy)/math.hypot(dx, dy)
    return route['startBedding']+(route['bedding']-route['startBedding'])*smoothstep(distance/1.2)


def route_bank_clearance(route, x, y):
    return min((max(0, route_sample(other, x, y)[0]-other['width']/2) for other in route.get('bankAvoidRoutes', [])), default=math.inf)


def height(spec, x, y):
    plane = spec["plane"]
    base = survey_height(spec['surveySurface'], x, y) if spec.get('surveySurface') else max(0.0, plane["a"] * x + plane["b"] * y + plane["c"])
    continuous = spec.get('continuousGrading', False)
    h = base
    for rect in spec["cutRects"]:
        blend = rect.get("blend", spec["cutBlend"])
        distance = rect_distance(rect, x, y)
        if distance < blend:
            h = min(h, rect["level"] + ((h if continuous else base) - rect["level"]) * smoothstep(distance / blend))
    for pad in spec["fillPads"]:
        if continuous:
            distance = rect_distance(pad, x, y)
            blend = pad.get('blend', pad.get('eastBlend'))
            if distance < blend:
                h = max(h, pad['level'] + (h - pad['level']) * smoothstep(distance / blend))
            continue
        if pad["x0"] <= x <= pad["x1"] and pad["z0"] <= y <= pad["z1"]:
            h = max(h, pad["level"])
        elif pad["x1"] < x < pad["x1"] + pad["eastBlend"] and pad["z0"] <= y <= pad["z1"]:
            h = max(h, pad["level"] + (base - pad["level"]) * smoothstep((x - pad["x1"]) / pad["eastBlend"]))
    for pad in spec["levelPads"]:
        blend = pad.get("blend", 2.0)
        distance = rect_distance(pad, x, y)
        if distance < blend:
            h = pad["level"] + ((h if continuous else base) - pad["level"]) * smoothstep(distance / blend)
    for rect in spec["postCuts"]:
        distance = rect_distance(rect, x, y)
        if distance < rect["blend"]:
            h = min(h, rect["level"] + (h - rect["level"]) * smoothstep(distance / rect["blend"]))
    pond = spec["pond"]
    radius = math.sqrt(((x - pond["cx"]) / pond["rx"]) ** 2 + ((y - pond["cz"]) / pond["rz"]) ** 2)
    if not continuous and radius <= 1:
        h = min(h, pond["edge"] - pond["depth"] * 0.5 * (1 + math.cos(radius * math.pi)))
    elif not continuous and radius < 1.3:
        h = min(h, pond["edge"] + ((h if continuous else base) - pond["edge"]) * smoothstep((radius - 1) / 0.3))
    if spec.get('houseExcavation'):
        excavation = spec['houseExcavation']
        distance = polygon_distance(excavation['points'], x, y)
        if distance < excavation['blend']:
            h = min(h, excavation['level'] + (h - excavation['level']) * smoothstep(distance / excavation['blend']))
    if spec.get('drivewayProfile'):
        profile = spec['drivewayProfile']
        distance = max(0, polygon_distance(profile['points'], x, y) - profile['edgeMargin'])
        if distance < profile['blend']:
            level = profile['startLevel'] + (profile['gateLevel'] - profile['startLevel']) * smoothstep((x - profile['startX']) / (profile['gate'][0] - profile['startX']))
            h = level + (h - level) * smoothstep(distance / profile['blend'])
    if spec.get('finishPads'):
        distance = min(rect_distance(pad, x, y) / pad['blend'] for pad in spec['finishPads'])
        if distance < 1:
            h = spec['finishedSoil'] + (h - spec['finishedSoil']) * smoothstep(distance)
    for pad in spec.get('protectedPads', []):
        distance = rect_distance(pad, x, y)
        if distance < pad['blend']:
            h = pad['level'] + (h - pad['level']) * smoothstep(distance / pad['blend'])
    gathering_samples = [(pad, rect_distance(pad, x, y) if 'radius' not in pad else max(0, math.hypot(x-pad['cx'], y-pad['cz'])-pad['radius'])) for pad in spec.get('gatheringPads', [])]
    core = next((pad for pad, distance in gathering_samples if distance == 0), None)
    if core is not None:
        h = core['level']
    else:
        total, level, strength = 0, 0, 0
        for pad, distance in gathering_samples:
            if distance < pad['blend']:
                influence = 1-smoothstep(distance/pad['blend'])
                weight = influence/(distance*distance)
                total += weight
                level += pad['level']*weight
                strength = max(strength, influence)
        if total:
            h += (level/total-h)*strength
    for route in [r for r in spec.get('routeProfiles', []) if r.get('bankApron')]:
        if route.get('bankBounds') and rect_distance(route['bankBounds'], x, y) > 0:
            continue
        nearest, level = route_sample(route, x, y, True)
        clear = min([rect_distance(p, x, y) for p in spec.get('finishPads', [])+spec.get('protectedPads', [])]+[d for _, d in gathering_samples]+[polygon_distance(spec['houseExcavation']['points'], x, y) if spec.get('houseExcavation') else math.inf])
        influence = (1-smoothstep(max(0, nearest-route['width']/2)/route['bankApron']['blend']))*smoothstep(clear/route['bankApron']['clearBlend'])*smoothstep(route_bank_clearance(route, x, y)/.6)
        h += (level-route.get('bedding', .04)-h)*influence
    for route in spec.get('routeProfiles', []):
        if route.get('bankBounds') and rect_distance(route['bankBounds'], x, y) > 0:
            continue
        distance, level = route_sample(route, x, y, True)
        distance = max(0, distance - route['width'] / 2)
        blend = route.get('bankBlend', .5)
        if distance < blend:
            bedding = route_bedding(route, x, y)
            clear = min([rect_distance(p, x, y) for p in spec.get('finishPads', [])+spec.get('protectedPads', [])]+[d for _, d in gathering_samples]) if route.get('approachBank') else math.inf
            influence = (1-smoothstep(distance/blend))*(smoothstep(clear/1.2) if route.get('approachBank') else 1)*smoothstep(route_bank_clearance(route, x, y)/.6)
            h += (level-bedding-h)*influence
            if route.get('approachBank'):
                h = min(h, h+(level-bedding-h)*(1-smoothstep(distance/.3))*smoothstep(route_bank_clearance(route, x, y)/.6))
    pond_outer = 1.3+(pond.get('northBankOuter', 1.3)-1.3)*max(0, (pond['cz']-y)/(pond['rz']*radius or 1))**16 if continuous and y < pond['cz'] else 1.3
    if continuous and radius <= 1:
        h = min(h, pond['edge'] - pond['depth'] * .5 * (1 + math.cos(radius * math.pi)))
    elif continuous and radius < pond_outer:
        h = min(h, pond['edge'] + (h - pond['edge']) * smoothstep((radius - 1) / (pond_outer-1)))
    if spec.get('gateRunback'):
        runback = spec['gateRunback']
        distance = polygon_distance(runback['points'], x, y)
        if distance < runback['blend']:
            h = runback['level']+(h-runback['level'])*smoothstep(distance/runback['blend'])
    if spec.get('wicketLanding'):
        landing = spec['wicketLanding']
        distance = polygon_distance(landing['points'], x, y)
        if distance < landing['blend'] and polygon_distance(landing['boundary'], x, y) < 1e-9:
            h = landing['level']+(h-landing['level'])*smoothstep(distance/landing['blend'])
    if spec.get('benchPad'):
        pad = spec['benchPad']
        distance = math.hypot(max(pad['x0']-x, 0, x-pad['x1'])/pad['blend'], max(pad['z0']-y, 0)/pad['blend'], max(y-pad['z1'], 0)/pad['southBlend'])
        if distance < 1:
            h = pad['level']+(h-pad['level'])*smoothstep(distance)
    if spec.get('productiveCourt'):
        court = spec['productiveCourt']
        distance = rect_distance(court, x, y)
        for route in court['routes']:
            distance = min(distance, max(0, route_sample(route, x, y)[0]-route['width']/2))
        weight = (1-smoothstep(distance/court['blend']))*(1-smoothstep((x-court['x1'])/court['eastBlend']))
        if weight:
            run = court['x1']-court['runStart']
            flat = sum(b-a for a, b in court['aisles'])
            progress = max(0, min(run, x-court['runStart']))-sum(max(0, min(b-a, x-a)) for a, b in court['aisles'])
            finish = court['greenhouseFinish']+(court['houseFinish']-court['greenhouseFinish'])*progress/(run-flat)
            greenhouse_weight = 1-smoothstep(rect_distance(court['greenhouse'], x, y)/.3)
            bedding = .06-.02*greenhouse_weight+.06*smoothstep((x-(court['x1']-.68))/.68)
            h += (finish-bedding-h)*weight
    return h
