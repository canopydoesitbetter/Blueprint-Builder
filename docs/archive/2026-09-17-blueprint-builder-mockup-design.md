> Transferred from Fabri-Cadabra on 2026-09-17 for historical reference. This document predates later four-wall, inch-only, and mobile-first decisions and should not be treated as the current UI specification.\n\n# Blueprint Builder Standalone Mockup Design

## Goal

Create a standalone, single-file HTML prototype for a simple fabrication blueprint builder. The prototype is intentionally isolated from the production Fabri-Cadabra app until the interaction model and visual design are approved.

The prototype should answer one core question: does creating tube stock, dragging it from a parts drawer onto a properly scaled fabrication grid, snapping members together, and inspecting the same assembly from synchronized 2D views feel clear and useful?

## Scope

The mockup includes the minimum useful blueprint workflow:

1. Create a finite blueprint workspace with user-selectable width, depth, and height, defaulting to 20 ft x 20 ft x 10 ft.
2. Create tube parts from a fixed tube library.
3. Store each created part in a quantity-based parts drawer.
4. Drag parts from the drawer onto a dimensionally accurate drafting surface.
5. Place axis-aligned members along X, Y, or Z while keeping the interface strictly 2D.
6. Inspect and edit one shared model through synchronized Top, Wall A, and Wall B projections.
7. Select, move, rotate a member 90 degrees, rotate the 2 x 6 face 90 degrees, and delete placed tubes.
8. Snap tubes to the inch grid and to physically compatible member endpoints, edges, and centerlines.
9. Pan and zoom the drawing while preserving true real-world coordinates.
10. Keep tube geometry true-scale while simplifying labels as the user zooms out.

The mockup does not add app persistence, project saving, BOM generation, cut lists, weld symbols, dimension annotations, undo/redo, arbitrary-angle editing, or production integration.

## Tube Library

The prototype supports exactly three tube profiles, all with 1/8 inch wall thickness:

- 2 in x 2 in x 1/8 in wall
- 3 in x 3 in x 1/8 in wall
- 2 in x 6 in x 1/8 in wall

The user selects a profile, enters tube length in feet/inches, enters quantity, and presses Add to Parts.

The profile stores its outside dimensions and wall thickness. The 2 x 6 profile also stores a 0/90 degree roll state around the member's own length axis so its 2 inch or 6 inch face is represented correctly in every projection.

## Blueprint Workspace

The drawing surface is finite. A new blueprint has editable Width, Depth, and Height values with defaults of:

- Width: 20 ft
- Depth: 20 ft
- Height: 10 ft

All geometry is stored in real-world inches. The default workspace is therefore 240 in x 240 in x 120 in.

Zoom and pan affect only the viewport. They never change a tube's stored geometry.

## Shared Model and 2D Projections

The interface is entirely 2D, but placed members are stored with real X, Y, and Z coordinates so all views remain synchronized.

The three views are:

- Top: X x Y
- Wall A: X x Z
- Wall B: Y x Z

Only one view is displayed at a time. Switching views redraws the same member collection from another projection; it never duplicates geometry.

Members are axis-aligned in this prototype and may run along X, Y, or Z. A member perpendicular to the current view renders end-on as its real cross-section so it remains visible and selectable.

## Placement Plane and Initial Orientation

Each view has a Placement Plane field for the hidden coordinate:

- Top: Elevation / Z
- Wall A: Depth / Y
- Wall B: Offset / X

When a user drags a staged part into a view, the visible two coordinates come from the drop location and the hidden coordinate comes from the active Placement Plane value.

A newly dragged member starts along the horizontal axis of the active view:

- Top: X
- Wall A: X
- Wall B: Y

Rotate 90 degrees toggles the selected member between the two axes visible in the active view:

- Top: X <-> Y
- Wall A: X <-> Z
- Wall B: Y <-> Z

This makes every X/Y/Z member constructible without exposing 3D controls. Placement Plane values must remain inside the workspace bounds.

## Placed Member Model

Each placed member stores at least:

- unique member ID
- source part ID
- profile dimensions
- wall thickness
- length in inches
- start X, Y, and Z coordinates in inches
- member axis: X, Y, or Z
- numeric rotation state reserved for future arbitrary-angle support
- profile roll / face rotation: 0 or 90 degrees

The stored X/Y/Z point is the member's start endpoint. Length extends in the positive direction of its axis. The profile is centered around the member centerline on its two cross-section axes.

## True-Scale Rendering

Placed tubes are rendered at their actual outside dimensions relative to the grid.

A 3 x 3 tube appears visibly wider than a 2 x 2 tube. A 2 x 6 tube uses its true rectangular cross-section, and Rotate Face 90 degrees changes the stored roll around the member length axis so all three projections update consistently.

Labels adapt to zoom:

- close zoom: show profile and length, for example `2 x 2 | 6'-4"`
- medium zoom: simplify the label
- far zoom: hide the label while keeping geometry true-scale

## Grid and Scale

All views use the same real-inch model space rules:

- Major grid: 12 in / 1 ft
- Intermediate grid: 3 in
- Fine grid: 1 in
- Placement snap increment: 1 in

Fine grid detail may be suppressed at wide zoom levels to prevent clutter. Foot markers and coordinate labels remain sufficient to understand scale.

## Parts Drawer

Created tube stock appears in a collapsible drawer. Each row shows:

- tube size
- 1/8 in wall
- tube length
- remaining quantity

Example: `2 x 2 x 1/8 — 6'-0" — 4 remaining`.

Dragging a part from the drawer onto the blueprint consumes one unit. A zero-quantity row remains visible but cannot be placed.

Deleting a placed member returns one unit to its source part quantity.

## Dragging, Selection, and Editing

Dragging from the parts drawer creates a placement preview in the active projection.

Placed members can be selected and dragged. Moving a member in one projection changes only the two coordinates visible in that projection; its hidden-axis coordinate remains unchanged. The other views therefore update automatically from the same member record.

The selected-member control contains:

- Move by drag
- Rotate 90 degrees
- Rotate Face 90 degrees when the profile is rectangular
- Delete

Dragging empty drawing space pans the viewport rather than moving geometry.

## Snapping

The prototype supports three snapping layers:

1. 1 in grid snapping
2. endpoint-to-endpoint snapping
3. endpoint-to-edge/centerline snapping

Object snapping is 3D-aware even though the interface is 2D. A member must not snap merely because two unrelated objects overlap in the current projection.

For a candidate object snap to be valid, the target geometry must physically coincide with or intersect the active member's hidden-axis placement. Endpoint snaps compare the corresponding X/Y/Z point. Edge/centerline snaps are allowed only where the target member physically crosses or lies on the candidate placement plane.

When a valid object snap is close enough, it takes precedence over plain grid snapping. A subtle marker or guide appears before the drop commits so the user can see the active snap target.

Snapping is geometric placement assistance only. The prototype does not calculate weld joints, miters, copes, trimming, or structural connectivity.

## Zoom and Pan

The active view includes:

- Zoom Out
- current zoom percentage
- Zoom In
- Fit

Mouse wheel / trackpad zoom should be supported where practical. Empty-space dragging pans the viewport. The mobile layout should prioritize drawing area and keep the parts library collapsible.

## Input and Validation

Width, Depth, and Height must be positive finite values.

Tube length must be a positive real-world measurement. The parser should accept common shop-style forms such as `6' 4"`, `6'-4"`, or a plain inch value such as `76`.

Quantity must be a positive whole number.

Placement Plane values must remain inside the corresponding hidden-axis bound.

A member cannot be placed or moved outside the finite workspace. The full member envelope, including its true cross-section, must fit inside the workspace. Invalid placement previews are shown as invalid and the drop does not commit.

A part cannot be placed when remaining quantity is zero.

## Rendering Architecture

SVG is the rendering technology for the prototype.

One shared model feeds three projection functions:

- projectTop(member)
- projectWallA(member)
- projectWallB(member)

Each projection produces 2D SVG geometry from the same X/Y/Z member record. End-on members render as cross-sections; in-plane members render as true-scale rectangles representing their visible tube face.

The prototype is a single self-contained HTML file with embedded CSS and JavaScript. Internal code remains logically separated into sections for:

- measurement parsing/formatting
- blueprint state
- parts-library state
- shared member model
- projection math
- SVG rendering
- viewport transforms
- drag/selection interaction
- 3D-aware snapping
- validation
- responsive controls

## Prototype File Location

The mockup lives outside production `www/` code at:

`fabrication_pro_capacitor/mockups/blueprint-builder.html`

No production application files, persistence keys, package metadata, release metadata, native branding, or Capacitor configuration are modified by this prototype.

## Verification

Verification should exercise behavior, not just page loading. At minimum confirm:

1. default workspace is 20 ft x 20 ft x 10 ft;
2. all three approved tube profiles can be staged with length and quantity;
3. each placement consumes one quantity and deletion returns one;
4. Top, Wall A, and Wall B show synchronized projections of the same member;
5. moving a member in one view updates its position in the others while retaining its hidden coordinate;
6. 90 degree member rotation follows the active view's axis pair and updates projections correctly;
7. 2 x 6 face rotation updates visible faces correctly in every projection;
8. placement-plane values affect the hidden coordinate correctly;
9. 1 in grid snapping works;
10. endpoint and edge/centerline snapping work with a visible snap guide and do not falsely snap unrelated geometry at another hidden coordinate;
11. zoom, pan, and Fit preserve scale and model coordinates;
12. full-envelope out-of-bounds placement is rejected;
13. perpendicular members remain visible and selectable as end-on cross-sections;
14. the mockup remains usable at desktop and narrow mobile widths.

## Success Criteria

The mockup is successful if a user can create a finite blueprint, stage tube stock, place members into one of three synchronized 2D views, inspect the same assembly accurately from Top / Wall A / Wall B, reposition and rotate members, understand real-world scale while zooming, and delete members while quantities remain correct.

The prototype is specifically for evaluating whether this blueprint-building interaction feels right before integration into Fabri-Cadabra.

## Explicit Non-Goals

- perspective or orbiting 3D view
- 3D modeling controls
- arbitrary-angle member editing
- dimension annotations
- weld symbols
- cut lists or BOMs
- optimizer integration
- persistence or backup integration
- import/export
- undo/redo
- multi-select
- copy/paste
- collision resolution or automatic trimming
- fabrication joint logic
- direct integration into Fabri-Cadabra
