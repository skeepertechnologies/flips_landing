from django.shortcuts import render
from django.http import JsonResponse, HttpRequest
from django.views.decorators.csrf import csrf_exempt
import os
import ee
import folium
import json
import logging

# Initialize logger
logger = logging.getLogger(__name__)

# Path to the service account key file
SERVICE_ACCOUNT_KEY_PATH = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "/app/key.json")

# Initialize Earth Engine with the service account key
def initialize_earth_engine():
    try:
        if SERVICE_ACCOUNT_KEY_PATH and os.path.exists(SERVICE_ACCOUNT_KEY_PATH):
            credentials = ee.ServiceAccountCredentials(None, SERVICE_ACCOUNT_KEY_PATH)
            ee.Initialize(credentials)
            logger.info("Earth Engine initialized successfully using service account credentials.")
        else:
            raise FileNotFoundError(f"Service account key file not found at {SERVICE_ACCOUNT_KEY_PATH}.")
    except Exception as e:
        logger.error(f"Error initializing Earth Engine: {e}")
        raise RuntimeError("Failed to initialize Earth Engine with service account credentials.") from e

# Home view rendering the map
def home(request: HttpRequest):
    logger.info("Rendering the home page.")
    try:
        # Initialize Earth Engine
        initialize_earth_engine()

        # Path to shapefiles
        shp_dir = os.path.join(os.getcwd(), "media", "shp")
        logger.debug(f"Shapefiles directory: {shp_dir}")

        # Create a map centered at a specific location
        m = folium.Map(location=[-0.8952018385249169, 37.46995686465638], zoom_start=12)

        # Style for GeoJson layer
        style_Tana = {"color": "blue"}

        # Add the GeoJson layer
        folium.GeoJson(
            os.path.join(shp_dir, "Tana.geojson"),
            name="Tana",
            style_function=lambda x: style_Tana,
        ).add_to(m)
        logger.info("Added GeoJson layer to the map.")

        # List of points with their coordinates and water levels
        points = [
            {
                "location": [-0.846078, 37.350598],
                "station_name": "Station 1",
                "current_level": "4.0 m",
                "warning_level": "4.0 m",
                "danger_level": "5.0 m",
            },
            {
                "location": [-0.920983, 37.451745],
                "station_name": "Station 2",
                "current_level": "3.0 m",
                "warning_level": "4.0 m",
                "danger_level": "5.0 m",
            },
            {
                "location": [-0.884660, 37.564385],
                "station_name": "Station 3",
                "current_level": "7.0 m",
                "warning_level": "4.0 m",
                "danger_level": "5.0 m",
            },
        ]

        # Add markers to the map
        for point in points:
            popup_text = (
                f"Station name: {point['station_name']}<br>"
                f"Current Water Level: {point['current_level']}<br>"
                f"Warning Water Level: {point['warning_level']}<br>"
                f"Danger Water Level: {point['danger_level']}"
            )
            folium.Marker(
                location=point["location"],
                popup=folium.Popup(popup_text, max_width=300),
                icon=folium.Icon(color="red", icon="info-sign"),
            ).add_to(m)

        logger.info("Added markers to the map.")

        # Add Google Maps and Satellite layers
        folium.raster_layers.TileLayer(
            tiles="https://mt1.google.com/vt/lyrs=r&x={x}&y={y}&z={z}",
            attr="Map data © Google",
            name="Google Maps",
        ).add_to(m)
        folium.raster_layers.TileLayer(
            tiles="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            attr="Tiles © Esri — Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom, 2012",
            name="Satellite",
        ).add_to(m)

        logger.info("Added Google Maps and Satellite layers.")

        # Add layer control
        folium.LayerControl().add_to(m)

        # Add a custom legend
        legend_html = """
        <div style="position: absolute;
                    bottom: 10px;
                    right: 10px;
                    width: 250px;
                    height: 150px;
                    border: 2px solid grey;
                    z-index: 9999;
                    font-size: 14px;
                    background-color: white;
                    padding: 10px;">
        &nbsp; <b>LEGEND</b><br>
        &nbsp; <i class="fa fa-map-marker fa-2x" style="color:blue"></i>&nbsp;Water Bodies<br>
        &nbsp; <i class="fa fa-map-marker fa-2x" style="color:red"></i>&nbsp;Danger Level<br>
        &nbsp; <i class="fa fa-map-marker fa-2x" style="color:orange"></i>&nbsp;Warning Level<br>
        &nbsp; <i class="fa fa-map-marker fa-2x" style="color:green"></i>&nbsp;Normal Level<br>
        </div>
        """
        m.get_root().html.add_child(folium.Element(legend_html))
        logger.info("Added custom legend to the map.")

        # Export map to HTML representation
        m = m._repr_html_()
        context = {"my_map": m}
        return render(request, "geoApp/home.html", context)
    except Exception as e:
        logger.error(f"Error rendering home page: {e}")
        return JsonResponse({"error": "Failed to render the home page."}, status=500)
# Home engine view rendering geo-related data
@csrf_exempt
def home_engine(request):
    context = {
        "Senser1_Lat": -0.9353436795002926,
        "Senser1_Long": 37.54556440748164,
        "senser1Geofence": {
            "type": "Polygon",
            "coordinates": [
                [
                    [37.532464, -0.932339],
                    [37.533579, -0.94607],
                    [37.554599, -0.945812],
                    [37.553659, -0.929163],
                    [37.532464, -0.932339],
                ]
            ],
        },
        "Senser2_Lat": -0.8429139763534353,
        "Senser2_Long": 37.44225988243562,
        "senser2Geofence": {
            "type": "Polygon",
            "coordinates": [
                [
                    [37.433852, -0.836992],
                    [37.434882, -0.848321],
                    [37.446807, -0.847634],
                    [37.446807, -0.834933],
                    [37.433852, -0.836992],
                ]
            ],
        },
    }
    return render(request, "home-engine.html", context)


@csrf_exempt
def analyze_roi(request):
    if request.method == "POST":
        logger.info("Received a POST request to analyze ROI.")
        try:
            # Initialize Earth Engine
            initialize_earth_engine()

            # Extract ROI GeoJSON from POST request
            aoi_geojson = request.POST.get("aoi")
            if not aoi_geojson:
                logger.error("No AOI provided in the request.")
                return JsonResponse({"error": "AOI is required."}, status=400)

            try:
                aoi_dict = json.loads(aoi_geojson)
                aoi = ee.Geometry(aoi_dict)
                logger.info(f"AOI parsed successfully: {aoi_dict}")
            except json.JSONDecodeError:
                logger.error("Invalid GeoJSON format.")
                return JsonResponse({"error": "Invalid GeoJSON format."}, status=400)

            # Load and process Sentinel-2 data
            s2 = ee.ImageCollection("COPERNICUS/S2_HARMONIZED") \
                .filterDate("2024-03-01", "2024-05-30") \
                .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 23)) \
                .filterBounds(aoi) \
                .map(lambda img: img.clip(aoi))

            rgb_vis = {
                "opacity": 1,
                "bands": ["B4", "B3", "B2"],
                "min": 392.63,
                "max": 1694.87,
                "gamma": 1,
            }
            # Apply NDWI calculation
            dataset = s2.median()
            ndwi = dataset.normalizedDifference(["B3", "B8"]).rename("NDWI")
            water_mask = ndwi.gt(0.3).selfMask()

            # Calculate flood extent
            flood_area = water_mask.multiply(ee.Image.pixelArea()).divide(1e6)
            flood_stats = flood_area.reduceRegion(
                reducer=ee.Reducer.sum(), geometry=aoi, scale=10, maxPixels=1e9
            ).getInfo()
            flood_area_sq_km = round(flood_stats.get("NDWI", 0), 2)

            logger.info(f"Flood area calculated: {flood_area_sq_km} sq km.")

            # Population exposure analysis
            population = ee.ImageCollection("WorldPop/GP/100m/pop") \
                .filterDate("2020-01-01", "2024-05-20") \
                .median() \
                .clip(aoi)
            exposed_population_stats = population.updateMask(water_mask).reduceRegion(
                reducer=ee.Reducer.sum(), geometry=aoi, scale=100, maxPixels=1e9
            ).getInfo()
            exposed_population = int(exposed_population_stats.get("population", 0))

            logger.info(f"Exposed population calculated: {exposed_population}.")

            # Load additional analysis layers
            water_occurrence = ee.Image("JRC/GSW1_4/GlobalSurfaceWater").select("occurrence").clip(aoi)
            gsw = ee.Image("JRC/GSW1_4/GlobalSurfaceWater")
            waterOccurrence = gsw.select('occurrence').clip(aoi)
            permanent_water = waterOccurrence.gt(80).selfMask()
            distance = permanent_water.fastDistanceTransform().divide(30).clip(aoi).reproject('EPSG:4326', None, 30)
            srtm = ee.Image("USGS/SRTMGL1_003").clip(aoi).reproject('EPSG:4326', None, 30)
            slope = ee.Terrain.slope(srtm)
            velocity = slope.divide(10)
            flow_time = distance.divide(velocity).mask(velocity.gt(0)).rename('FlowTime')
            flow_time_minutes = flow_time.divide(60)

            # Compile analysis layers
            analysis_layers = {
                "aoi": aoi_dict,
                "water_occurrence": waterOccurrence.getMapId({'min': 0, 'max': 100, 'palette': ['white', 'blue']})[
                    'tile_fetcher'].url_format,
                "ndwi": ndwi.getMapId({'min': -1, 'max': 1, 'palette': ['00FFFF', '0000FF']})[
                    'tile_fetcher'].url_format,
                "population": population.getMapId({'min': 0.0016165449051186442, 'max': 10.273528099060059,
                                                   'palette': ['white', 'yellow', 'orange', 'red']})[
                    'tile_fetcher'].url_format,
                "dataset_without_cloud": dataset.getMapId(rgb_vis)['tile_fetcher'].url_format,
                "permanent_water": permanent_water.getMapId({'palette': 'blue'})['tile_fetcher'].url_format,
                "distance":
                    distance.getMapId({'max': 500, 'min': 0, 'palette': ['blue', 'cyan', 'green', 'yellow', 'red']})[
                        'tile_fetcher'].url_format,
                "elevation": srtm.getMapId({'min': 1000, 'max': 1500, 'palette': ['green', 'yellow', 'red']})[
                    'tile_fetcher'].url_format,
                "slope": slope.getMapId({'min': 0, 'max': 22, 'palette': ['white', 'green', 'yellow', 'red']})[
                    'tile_fetcher'].url_format,
                "flow_velocity": flow_time.getMapId({'min': 0, 'max': 6, 'palette': ['blue', 'cyan', 'yellow', 'red']})[
                    'tile_fetcher'].url_format,
                "flow_time_minutes":
                    flow_time_minutes.getMapId({'min': 0, 'max': 500, 'palette': ['blue', 'cyan', 'yellow', 'red']})[
                        'tile_fetcher'].url_format,
            }

            # Legend definitions
            legends = {
                "water_occurrence": {"description": "Water occurrence", "colors": ["white", "blue"]},
                "ndwi": {"description": "Normalized Difference Water Index", "colors": ["cyan", "blue"]},
                "population": {"description": "Population density", "colors": ["white", "yellow", "orange", "red"]},
                "permanent_water": {"description": "Permanent water bodies", "colors": ["blue"]},
                "distance": {"description": "Distance to permanent water", "colors": ["blue", "cyan", "yellow", "red"]},
                "elevation": {"description": "Elevation levels", "colors": ["green", "yellow", "red"]},
                "slope": {"description": "Slope levels", "colors": ["white", "green", "yellow", "red"]},
                "flow_velocity": {"description": "Flow velocity", "colors": ["blue", "cyan", "yellow", "red"]},
                "flow_time_minutes": {"description": "Flow time (minutes)", "colors": ["blue", "cyan", "yellow", "red"]},
            }

            # Return the analysis results and legends
            return JsonResponse({
                "flood_area_sq_km": flood_area_sq_km,
                "exposed_population": exposed_population,
                "analysis_layers": analysis_layers,
                "legends": legends,
            })

        except Exception as e:
            logger.error(f"Error analyzing ROI: {e}")
            return JsonResponse({"error": str(e)}, status=500)

    logger.warning("Invalid request method for /analyze-roi/.")
    return JsonResponse({"error": "Invalid request method."}, status=400)

