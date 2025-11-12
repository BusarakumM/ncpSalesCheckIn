"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

type LoadingButtonProps = React.ComponentProps<typeof Button> & {
  loading?: boolean;
  loadingLabel?: React.ReactNode;
};

const LoadingButton = React.forwardRef<HTMLButtonElement, LoadingButtonProps>(
  ({ loading, loadingLabel, children, className, disabled, ...rest }, ref) => {
    const isLoading = !!loading;
    return (
      <Button
        ref={ref}
        disabled={isLoading || disabled}
        className={
          (className || "") +
          " disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center"
        }
        {...rest}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {loadingLabel ?? children}
          </>
        ) : (
          children
        )}
      </Button>
    );
  }
);

LoadingButton.displayName = "LoadingButton";

export default LoadingButton;

