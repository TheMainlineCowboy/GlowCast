# GlowCast App Architecture

## Recommended First Stack

Start with a web app prototype:

- Vite
- React
- TypeScript
- Canvas/SVG overlay tools

This lets the idea be tested quickly before committing to native mobile complexity.

## Future Mobile Stack Options

### Option A: React Native

Good if reusing React logic from the prototype matters.

### Option B: Flutter

Strong for mobile rendering, animation, and consistent UI.

### Option C: Native iOS/Android

Best for camera, display output, video encoding, and device-specific performance, but slower and more expensive.

## Key App Modules

### Surface Capture

- take photo
- import photo
- store aspect ratio
- optionally store camera metadata later

### Mask Editor

- shapes
- polygons
- paint mask
- include/exclude
- invert
- feather
- undo/redo

### Effect Engine

- starter generated effects
- video overlays
- template packs
- mask-aware effects

### Export Engine

- alignment PNG
- MP4 render
- mask PNG
- project JSON

### Projection Engine

- full-screen output
- calibration grid
- saved projector presets

### AI Detection

- future segmentation model
- rectangles/window detection
- user-confirmed suggestions

## Data Model

A project should save:

- surface image
- surface aspect ratio
- mask zones
- include/exclude state
- selected effect
- export settings
- calibration settings
