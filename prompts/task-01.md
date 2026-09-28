# Prompt for UI/UX & React Implementation: Data-Bound Auto-Sectioning Visualizer

## Role & Context
Act as a React Frontend Developer. We are upgrading the `AutoAssignVisualizer` component inside the Temporary Sections modal.

Currently, the animation uses static, hardcoded nodes, and the Regular BEC sorting phase lacks containment UI. We need to bind this visualizer to the actual fetched data for the selected grade level using a "Representative Node" strategy coupled with dynamic, ticking number counters. Furthermore, we must introduce distinct dashed-outline `div` containers (drop-zones) for all phases—explicitly isolating SCP tracks (STE, SPA, SPS), the Top BEC (Star/Homogeneous) sections, and the Regular BEC (Heterogeneous) sections.

## Critical Technical Directive
Do not render more than 40-50 visual nodes (circles) in the DOM simultaneously to prevent browser lag. Use React state to drive live numeric counters alongside the representative nodes. Rely strictly on our established React design system components (no raw utility classes in the markup). All drop-zones must use a consistent dashed border styling to indicate they are receiving containers.

## UI Component & Animation Logic Requirements

Please implement the following data integration and animation sequence:

### 1. Data Hydration & Component Interface
The visualizer component must accept a `poolStats` prop containing the exact fetched counts before the animation begins:

```javascript
{
  totalLearners: 450,
  scp: { ste: 35, spa: 40, sps: 20 },
  topBec: { count: 80, sections: 2 },
  regularBec: { count: 275, sections: 6 }
}
```

### 2. The 4-Phase Animation Sequence
Implement a seamless, timed transition through these four distinct phases, updating the explanatory text dynamically:

*   **Phase 1: The Master Pool (Data Fetching)**
    *   *Visuals:* Render a central cluster of ~30-40 representative nodes (mixed Blue/Pink for gender).
    *   *Dynamic UI:* Above the cluster, render a large, prominent counter that rapidly ticks up from `0` to `poolStats.totalLearners`. 
    *   *Text:* "Phase 1: Fetching verified enrollments and EOSY promotion data..."

*   **Phase 2: SCP Extraction (Strict Separation)**
    *   *Visuals:* Three distinct dashed-outline drop-zones appear at the top: `STE Section`, `SPA Section`, and `SPS Section`. Representative nodes break away from the main cluster and fly into their respective zones.
    *   *Dynamic UI:* Small counters appear under each drop-zone, ticking up to their exact fetched amounts. The main pool counter simultaneously subtracts these amounts.
    *   *Text:* "Phase 2: Isolating qualified Special Curricular Program learners into specialized sections."

*   **Phase 3: Top BEC Extraction (Star Sections)**
    *   *Visuals:* The SCP containers fade out. A new large dashed-outline drop-zone appears labeled `Top BEC Sections (Homogeneous)`. The nodes with the highest internal averages detach from the pool, organize into a vertical line, and glide into this new container.
    *   *Dynamic UI:* A counter inside the Top BEC container ticks up to `poolStats.topBec.count`, while the main pool counter continues to decrease.
    *   *Text:* "Phase 3: Sorting and placing top-performing learners into Top BEC sections."

*   **Phase 4: Regular BEC Snake Draft Distribution**
    *   *Visuals:* The Top BEC container fades out. Multiple dashed-outline drop-zones appear (representing `poolStats.regularBec.sections`, e.g., Section A, Section B, Section C). The remaining nodes in the pool arrange vertically, then snake back and forth into these boxes (e.g., Section A -> B -> C -> C -> B -> A).
    *   *Dynamic UI:* The central pool counter rapidly ticks down to `0`. The capacity counters inside the Regular BEC boxes tick up to their maximums, displaying a split Male/Female count to prove gender balancing.
    *   *Text:* "Phase 4: Executing heterogeneous draft to balance academic performance and gender ratio."

### 3. State Management & Playback
*   Use a state machine or a step-based hook (e.g., `currentPhase: 1 | 2 | 3 | 4`) to manage the timeline.
*   Ensure the animation resets cleanly if the user closes and reopens the modal. 
*   If the user's browser triggers the `prefers-reduced-motion` media query, bypass the flying node animations and instantly render the final sorted layout with the correct fetched numbers inside the dashed containers.