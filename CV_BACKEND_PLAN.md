# GlowCast High-Precision CV Backend Plan

## Goal

Transform a normal smartphone photo into a flattened, masked, and depth-aware projection canvas.

This moves GlowCast away from fragile browser-only rectangle detection and toward a real multi-stage Computer Vision pipeline.

## Pipeline Overview

1. Geometric alignment
2. Pixel-perfect segmentation
3. Depth-based surface mapping
4. Edge refinement and vectorization
5. UI refinement and export

---

## 1. Geometric Alignment Preprocessing

### Preferred providers

- ControlNet with MLSD
- Custom OpenCV Hough Transform service
- Optional future fallback: browser-side line detection for low-quality preview only

### Input

- Original uploaded smartphone image

### Output

- Detected vertical architectural lines
- Detected horizontal architectural lines
- Vanishing points
- Homography matrix
- Flattened wall-plane polygon
- Perspective-corrected wall image

### Logic

The backend should identify dominant building lines first. It should use those lines to calculate vanishing points and generate a homography warp.

The warped image becomes the canonical image used for segmentation, masking, and export.

### Why this matters

Masking before perspective correction causes the app to chase distorted shapes. The wall must be squared before masks are drawn.

---

## 2. Pixel-Perfect Masking with SAM 2

### Provider

- Meta Segment Anything Model 2 API or hosted SAM 2 inference endpoint

### Input

- Perspective-corrected wall image
- Text/task prompt
- Optional positive and negative user points

### Prompt

Segment architectural openings and avoid zones:

- window glass
- door frames
- glass panels
- vents
- lights
- signs
- protruding fixtures
- columns/posts when they interrupt the wall plane

### Output

The app must request masks, not bounding boxes.

Acceptable formats:

- binary alpha masks
- polygon masks
- SVG paths

### Storage

Each mask should be saved as:

```ts
type ProjectionMask = {
  id: string;
  label: string;
  confidence: number;
  polygon: { x: number; y: number }[];
  svgPath: string;
  alphaMaskUrl?: string;
  depthRole?: 'recessed' | 'protruding' | 'surface';
};
```

---

## 3. Depth-Based Surface Mapping

### Preferred providers

- Depth Anything V2
- MiDaS

### Input

- Original uploaded image
- Perspective-corrected image if available

### Output

- monocular depth map
- largest continuous wall-depth plane
- recessed zones
- protruding zones

### Logic

The app should identify the largest continuous plane with the same depth value as the primary wall.

Automatic avoid-zone proposals:

- recessed: glass, door openings, dark window interiors
- protruding: columns, lights, vents, fixtures, plants, decor

Depth should not replace SAM segmentation. It should validate and classify SAM masks.

---

## 4. Edge Refinement and Vectorization

### Preferred implementation

- OpenCV Canny Edge Detection
- Contour detection
- Polygon simplification
- Optional mask snapping to nearby high-contrast edges

### Logic

AI masks should be snapped to the strongest nearby architectural edges.

This prevents masks from floating slightly off window trim, door frames, or vents.

### Final mask adjustment

Add a global inset/outset value:

- -10px to contract masks
- +10px to expand masks

Purpose:

- compensate for projector light bleed
- compensate for lens focus softness
- avoid haloing around physical edges

---

## 5. UI and Manual Override

### Add Mask / Remove Mask

When the user taps the photo:

- Add Mask sends the coordinate as a SAM 2 positive point
- Remove Mask sends the coordinate as a SAM 2 negative point

The API should return an updated polygon mask.

### Mask Inset/Outset Slider

Global slider:

- 0 default
- 1 to 10px expand
- -1 to -10px contract

### Toggle behavior

Every detected mask should be independently toggleable as an Avoid Zone.

---

## Final Export Requirements

The app should export:

1. High-resolution PNG mask overlay
2. Flattened 16:9 projection template
3. SVG mask paths
4. Optional JSON project file
5. Optional alpha-channel mask image

Recommended export size:

- 1920x1080 baseline
- future premium: 3840x2160

---

## Cloudflare Pages Function Endpoint

Initial endpoint added:

```txt
POST /api/analyze-projection
```

Request:

```json
{
  "imageDataUrl": "data:image/jpeg;base64,...",
  "refinement": {
    "positivePoints": [{ "x": 0.42, "y": 0.51 }],
    "negativePoints": [{ "x": 0.63, "y": 0.22 }],
    "maskInsetOutsetPx": 4
  }
}
```

Response:

```json
{
  "surface": {
    "polygon": [],
    "svgPath": "",
    "homography": [],
    "depthPlane": {}
  },
  "masks": [],
  "flattenedTemplate": {
    "width": 1920,
    "height": 1080,
    "aspectRatio": "16:9"
  }
}
```

---

## Required Environment Variables

```txt
GEOMETRY_API_URL=
GEOMETRY_API_KEY=
SAM2_API_URL=
SAM2_API_KEY=
DEPTH_API_URL=
DEPTH_API_KEY=
```

If providers are not configured, the endpoint returns structured warnings instead of failing silently.
