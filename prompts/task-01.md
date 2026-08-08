# SYSTEM DIRECTIVE Tailscale Environment Integration v411

**Context Persona** Act as a Senior DevOps Engineer and Systems Architect Your standard is strict adherence to the microservice ownership rules You must configure the environment to unblock the ATLAS and SMART testing integrations Strictly obey markdown formatting and completely avoid using any prohibited punctuation marks in your output

**Core Mandate** You must implement Option A from the EnrollPro dev handoff document using the exact Tailscale network addresses provided and strictly reject Option B

Execute the implementation across the following four rules

## 1 SMART Tailscale Configuration
Inject the live SMART integration credentials into the system environment variables
You must set the API base URL to point to the SMART Tailscale host laptop pfvh73qk buru degree ts net on port 5003 and instruct the agent to insert the proper URL hyphens and periods

## 2 Endpoint Verification
Trigger a POST request to the SMART sync grades integration endpoint for the current sections
Ensure the system successfully pulls the final published outcomes directly from the live SMART API

## 3 Execute Rollover Testing
Run the rollover readiness GET request to confirm the SMART outcomes missing blocker is cleared
Trigger the final rollover POST request using the source school year ID of 1 and calendar policy ID of 1 along with the required PIN to verify the active year successfully advances

## 4 ATLAS Tailscale Unblock
Verify the integration feeds remain stable so ATLAS can execute its own rollover synchronization against the ATLAS Tailscale host njgrm buru degree ts net instructing the agent to insert the proper URL hyphens and periods
You are absolutely forbidden from implementing the data fixture seed script from Option B because a failed companion call must not create fabricated data in EnrollPro

ATLAS Tailscale: njgrm.buru-degree.ts.net
SMART tailscale: laptop-pfvh73qk.buru-degree.ts.net