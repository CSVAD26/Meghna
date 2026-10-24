# Fun Animation Lab

## Overview

*Fun Anim*ation Lab* is a 2D frame-by-frame animation tool built using p5.js. This was designed with a focus on simplicity and accessibility where the application removes the steep learning curve typically associated with professional animation software. My intention was for users of all backgrounds to sketch, color, and animate without requiring extensive prior technical knowledge or verbal instruction.

---

## Core Design Principles & Intentions

### 1. Lowering the Barrier to Entry
Traditional animation pipelines often overwhelm first-time users with complex timelines, layer masks, and dense toolbars. I wanted *Fun Animation Lab* to streamline this process. I wanted users to be introduced to a simplisitc, distraction-free drawing interface with a helpful frame strip at the bottom.

### 2. Imposed Aesthetic Constraints and Color Progression
A defining feature of this project is its intentional aesthetic constraint. The color palette is not chosen per stroke or frame, but evolves dynamically across the animation sequence with the start and end color.

* **Dynamic Color Interpolation:** UUtilizing custom hue math, the application establishes a gradient bridging a **START** hue (default red) and an **END** hue (default blue) across the total frame count.
* **Motion-Color Parallel Progression:** This mirrors the progression of motion in frame-by-frame animation, establishing a visual relationship where the evolution of color directly parallels the evolution of time and space.
* **Controlled Frame Limits:** The tool restricts frame counts between `2` and `9`. My intention was to start users off with a minimum of 2 frames (rather than a single static canvas) to nudge them to immediately consider transition, movement, and relationship between successive states before scaling up complexity.

### 3. Onion Skinning for Spatial Context
To aid the creative workflow, the tool incorporates an **onion-skinning** feature. When paused in editing mode, previous frames render with a progressive opacity fade (nearest previous frame at 45% reduction, scaling down by factor). This gives creators immediate visual feedback and spatial continuity as they sketch successive movements.

---

## User Interaction & Interface

I feel the animation application itself is visually minimalistic, Additionally, there are instructions at the footer for keyboard and mouse controls: 

| Feature | Key / Control | Function |
| :--- | :--- | :--- |
| **Drawing** | Mouse Click & Drag | Draw smooth vector strokes on the central white canvas. |
| **Frame Count** | `2` – `9` | Dynamically set the frame count (Frame 1 = Start Color; Frame $N$ = End Color). |
| **Navigation** | `N` or `Enter` / `B` | Advance to the next frame (`N` / `Enter`) back to the previous frame (`B`). |
| **Playback** | `Space` | Toggle between **EDITING** and **PLAYING** states. |
| **Playback Mode** | `P` | Switch between `"loop"` and `"ping-pong"` modes. |
| **Speed Control** | `+` / `−` | Real-time fine-tuning of frame rates (FPS) ranging from 1 to 60. |
| **Canvas Clear** | `C` | Wipe the active frame's graphics layer clean. |
| **Color Sliders** | HTML Sliders | Dynamically adjust start and end hue ranges with live preview swatches. |

---

## Review Insights & Future Enhancements

Testing the tool during the peer review process really offered me invaluable insights into user behavior and interface design:

### The Paradox of Instructions
Initially, I planned on not adding any instructions. However, as the tool became more sophisticated, I was worried that the user will have no idea how to navigate the tool. So, I later added more explicit text instructions to the footer to guide users. However, observation revealed that these text prompts were largely ignored. Users preferred an exploratory approach (clicking interface elements, pressing keys, and interpreting visual cues that made sense to them).

### UX Heuristics: Consistency and Standards
This observation reminded me of a core UX heuristic I had learned for iOS development: **Consistency and Standards**. This is when the users naturally map familiar software conventions in their minds when using another application or tool. I think if I were to make a future iterations of the tool, it would benefit heavily from aligning more closely with standardized digital design paradigms (such as recognizable toolbar icons for play, pause, next, and clear) rather than relying on text explanations.

### Expanded Artistic Tools
Another avenue for future enhancement is introducing adjustable stroke weights, opacity dynamics, and variable brush flows to mimic physical media like pencils or ink pens, encouraging both playfulness and realism into the drawing experience.

---

## Conclusion
Ultimately, my intention for *Fun Animation Lab* was to encourage playful artistic expression. This project provided me lots of insights into how interactive software can be engineered for intuitive user exploration.