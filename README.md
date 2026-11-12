# Billy's Garage

A 3D car garage for a three-year-old: pick a car, paint it, bolt on parts, muddy it, wash it, and send it round the track over a jump.

Everything — cars, wheels, textures and sounds — is generated in code. There are no model, image or audio files.

## Web (main version)

`web/` is the Three.js version, playable at [billys-garage.frogdog.io](https://billys-garage.frogdog.io). Add it to the iPad home screen from Safari; it works offline and updates itself.

```bash
cd web
npm install
npm run dev
```

Handy URL options: `?fps` shows frame rate and draw calls, and in dev `?washnow&at=2000` (or `?gonow`, `?mudnow=3`) fast-forwards an animation for screenshots.

## iPad (native)

`VroomGarage/` is the original SwiftUI + SceneKit app. Open `VroomGarage.xcodeproj` in Xcode. `PROGRESS.md` logs how it was built.
