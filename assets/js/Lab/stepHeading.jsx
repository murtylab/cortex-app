import React from "react";

export default function StepHeading({ children, id, className }) {
  return (
    <div className={className ? `lab-step-heading ${className}` : "lab-step-heading"} id={id}>
      <span className="lab-step-mark" aria-hidden="true" />
      <span className="lab-step-heading-text">{children}</span>
    </div>
  );
}
