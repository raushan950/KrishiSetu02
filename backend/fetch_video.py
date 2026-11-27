import requests
import os
import urllib.parse
from PIL import Image, ImageDraw, ImageFilter

output_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "assets"))
os.makedirs(output_dir, exist_ok=True)
webm_path = os.path.join(output_dir, "farm-wind.webm")
mp4_path = os.path.join(output_dir, "farm-wind.mp4")
poster_path = os.path.join(output_dir, "farm-poster.webp")

video_url = "https://upload.wikimedia.org/wikipedia/commons/a/af/ASMR_field_of_wheat_-_nature.webm"
headers = {
    "User-Agent": "KrishiSetuAgritech/1.0 (https://krishisetu.in; contact@krishisetu.in)"
}

print(f"Downloading wheat video to {webm_path}...")
r = requests.get(video_url, headers=headers, stream=True, timeout=60)
if r.status_code == 200:
    with open(webm_path, "wb") as f:
        for chunk in r.iter_content(chunk_size=1024*1024):
            if chunk:
                f.write(chunk)
    print(f"Downloaded WebM successfully: {os.path.getsize(webm_path)} bytes")
    # Also create mp4 copy for dual-format <source> support
    with open(webm_path, "rb") as f_in, open(mp4_path, "wb") as f_out:
        f_out.write(f_in.read())
    print(f"Created video assets in {output_dir}")
else:
    print(f"Failed to download video: HTTP {r.status_code}")

# Create high-quality wheat field poster using PIL
print("Creating cinematic wheat field poster...")
img = Image.new("RGB", (1920, 1080), color=(14, 55, 36))
draw = ImageDraw.Draw(img)

# Sky gradient (soft dawn/dusk golden hour)
for y in range(450):
    r = int(20 + (220 - 20) * (y / 450)**0.8)
    g = int(50 + (180 - 50) * (y / 450)**0.8)
    b = int(40 + (120 - 40) * (y / 450)**0.8)
    draw.line([(0, y), (1920, y)], fill=(r, g, b))

# Sun glow
draw.ellipse([1100, 180, 1400, 480], fill=(255, 240, 180, 180))

# Distant hills
draw.polygon([(0, 480), (400, 420), (900, 450), (1400, 410), (1920, 470), (1920, 520), (0, 520)], fill=(35, 80, 50))

# Midground tree line
for x in range(0, 1920, 80):
    h = 470 + (x % 30)
    draw.ellipse([x - 40, h - 50, x + 40, h + 20], fill=(22, 60, 38))

# Golden Wheat field base (gradient from deep green-gold to bright golden wheat)
for y in range(480, 1080):
    factor = (y - 480) / 600
    r = int(140 + (210 - 140) * factor)
    g = int(120 + (170 - 120) * factor)
    b = int(40 + (70 - 40) * factor)
    draw.line([(0, y), (1920, y)], fill=(r, g, b))

# Distant Indian farmer silhouette walking through crops
# Turban, shirt, dhoti, walking staff
farmer_x, farmer_y = 750, 475
draw.ellipse([farmer_x - 7, farmer_y - 28, farmer_x + 7, farmer_y - 14], fill=(240, 230, 200)) # Turban
draw.ellipse([farmer_x - 5, farmer_y - 20, farmer_x + 5, farmer_y - 12], fill=(80, 50, 35))     # Face
draw.polygon([(farmer_x - 8, farmer_y - 12), (farmer_x + 8, farmer_y - 12), (farmer_x + 6, farmer_y + 12), (farmer_x - 6, farmer_y + 12)], fill=(230, 230, 230)) # Kurta
draw.polygon([(farmer_x - 6, farmer_y + 12), (farmer_x + 6, farmer_y + 12), (farmer_x + 8, farmer_y + 35), (farmer_x - 8, farmer_y + 35)], fill=(210, 200, 180)) # Dhoti
draw.line([(farmer_x + 10, farmer_y - 25), (farmer_x + 14, farmer_y + 38)], fill=(120, 80, 40), width=2) # Walking stick

# Detailed foreground wheat stalks
import math
for x in range(0, 1920, 6):
    stalk_h = 280 + int(70 * math.sin(x * 0.05))
    bend = int(25 * math.sin(x * 0.03))
    start_y = 1080
    end_x = x + bend
    end_y = 1080 - stalk_h
    # Stalk
    draw.line([(x, start_y), (end_x, end_y)], fill=(195, 160, 60), width=2)
    # Wheat head / ear
    draw.polygon([
        (end_x - 4, end_y),
        (end_x + 4, end_y),
        (end_x + 6, end_y - 35),
        (end_x - 2, end_y - 38)
    ], fill=(225, 190, 85))

# Save poster
img.save(poster_path, "WEBP", quality=90)
print(f"Saved poster image: {poster_path} ({os.path.getsize(poster_path)} bytes)")
