import { RouterProvider } from "react-router";
import { router } from "./router";
import { TimeMachineWidget } from "./shared/components/TimeMachineWidget";

function App() {
  return (
    <>
      <RouterProvider router={router} />
      <TimeMachineWidget />
    </>
  );
}

export default App;
