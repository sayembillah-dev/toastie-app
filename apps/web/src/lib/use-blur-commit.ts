import { useEffect, useRef, useState } from 'react';

/** Text/number fields keep their edits in local state and only push to the
 * API once the field loses focus — an API call per keystroke would hammer
 * the backend and fight the user's own cursor as the request round-trips. */
export function useBlurCommit<T>(value: T, commit: (value: T) => void) {
  const [local, setLocal] = useState(value);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setLocal(value);
  }, [value]);

  return {
    value: local,
    onChange: setLocal,
    onFocus: () => {
      focused.current = true;
    },
    onBlur: () => {
      focused.current = false;
      if (local !== value) commit(local);
    },
  };
}
