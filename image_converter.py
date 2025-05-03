import numpy as np
import pandas as pd
from sqlalchemy import create_engine
import rasterio
from rasterio.transform import from_origin

# Connect to MySQL and retrieve data
engine = create_engine('mysql+pymysql://root:1391@localhost:3306/flips')
query = """
SELECT w.id, w.rig_id, w.level, w.temperature, w.humidity, w.timestamp, 
       r.id, r.sensor_id, r.location, r.latitude, r.longitude 
FROM waterleveldata w 
JOIN rigs r ON w.rig_id = r.id;
"""
data = pd.read_sql(query, engine)

# Define raster parameters (Assuming a rough grid for example purposes)
resolution = 0.01  # Define resolution of grid cells, in degrees
min_lat, max_lat = data['latitude'].min(), data['latitude'].max()
min_lon, max_lon = data['longitude'].min(), data['longitude'].max()

# Calculate the number of rows and columns based on resolution
nrows = int((max_lat - min_lat) / resolution) + 1
ncols = int((max_lon - min_lon) / resolution) + 1

# Create a numpy array for raster data, with NaN values initially
raster_data = np.full((nrows, ncols), np.nan)

# Assign values to raster cells with boundary checks
for _, row in data.iterrows():
    row_idx = int((row['latitude'] - min_lat) / resolution)
    col_idx = int((row['longitude'] - min_lon) / resolution)
    
    # Check if indices are within bounds
    if 0 <= row_idx < nrows and 0 <= col_idx < ncols:
        raster_data[row_idx, col_idx] = row['level']  # or use temperature/humidity
    else:
        print(f"Warning: Point ({row['latitude']}, {row['longitude']}) is out of bounds for the raster grid.")

# Define the transformation for the raster
transform = from_origin(min_lon, max_lat, resolution, resolution)

# Write to GeoTIFF using Rasterio
with rasterio.open(
    'water_flow_analysis.tif',
    'w',
    driver='GTiff',
    height=nrows,
    width=ncols,
    count=1,
    dtype=raster_data.dtype,
    crs='EPSG:4326',
    transform=transform,
) as dst:
    dst.write(raster_data, 1)
