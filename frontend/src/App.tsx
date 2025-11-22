import { useIsInitialized, useIsSignedIn } from "@coinbase/cdp-hooks";
import { useEffect, useRef } from "react";

import Loading from "./common/Loading";
import SignInScreen from "./common/SignInScreen";
import BasenameGate from "./basename/BasenameGate";

const BYPASS_KEY = "cdp-split-basename-bypass";

/**
 * This component how to use the useIsIntialized, useEvmAddress, and useIsSignedIn hooks.
 * It also demonstrates how to use the AuthButton component to sign in and out of the app.
 */
function App() {
  const { isInitialized } = useIsInitialized();
  const { isSignedIn } = useIsSignedIn();
  const prevSignedInRef = useRef<boolean | undefined>(undefined);

  // Clear bypass when user signs out
  useEffect(() => {
    // Only act when isSignedIn changes from true to false
    if (prevSignedInRef.current === true && isSignedIn === false) {
      try {
        localStorage.removeItem(BYPASS_KEY);
        console.log("Cleared basename bypass on sign out");
      } catch (e) {
        console.error("Failed to clear bypass on sign out:", e);
      }
    }
    prevSignedInRef.current = isSignedIn;
  }, [isSignedIn]);

  return (
    <div className="app flex-col-container flex-grow">
      {!isInitialized && <Loading />}
      {isInitialized && (
        <>
          {!isSignedIn && <SignInScreen />}
          {isSignedIn && <BasenameGate />}
        </>
      )}
    </div>
  );
}

export default App;
