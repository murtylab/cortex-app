import React from "react";

/** @param {{ children: import("react").ReactNode, id?: string, className?: string }} props */
export default function StepHeading({ children, id = undefined, className = "" }) {
  return (
    <div className={className ? `lab-step-heading ${className}` : "lab-step-heading"} id={id}>
      <span className="lab-step-mark" aria-hidden="true" />
      <span className="lab-step-heading-text">{children}</span>
    </div>
  );
}
