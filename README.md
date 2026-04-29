# GlowCast

GlowCast is a phone-first projection mapping app concept designed to make projection mapping simple enough for normal people.

Core promise:

**Take a photo → detect or mark projection areas → choose what to project on or around → apply an animation → project directly or export.**

## Why GlowCast Exists

Most projection mapping tools are powerful but intimidating. GlowCast is meant to feel more like Canva or CapCut than professional VJ software.

The first usable version should help someone decorate a house, garage door, window, storefront, stage wall, or event backdrop without learning projection mapping terminology.

## Two Main Workflows

### Direct Projection Mode

Phone connects to a projector through USB-C/HDMI, AirPlay, or other supported display output.

Use this for live playback, calibration grids, and fast simple projection.

### Export Mode

The user creates the map on the phone or web app, exports the final video and alignment guide, then plays it from a computer, media player, flash drive, or projector.

This mode is important because it avoids phone/projector compatibility problems.

## MVP Target

The first prototype should prove this:

1. Import or take a photo of the projection surface.
2. Manually define projection zones.
3. Choose whether to project on selected zones or around them.
4. Apply a starter animation/effect.
5. Export an alignment guide.
6. Later: export a final MP4/video loop.

## Current Starter Prototype

This starter repo includes a Vite + React prototype with:

- photo upload
- dummy AI detection button
- manual rectangular projection zones
- include/exclude mode
- invert/project-around mode
- starter visual effects
- alignment guide PNG export
- free watermark preview

## Run Locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Recommended First Real Build Upgrade

Replace dummy AI detection with real segmentation later, but do not start there.

First make manual mapping feel great.

Then add AI suggestions.

## v0.3 Focus

The next major focus is real AI-assisted mask detection and true zone-aware effects.
