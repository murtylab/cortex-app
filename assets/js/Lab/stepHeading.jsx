import React from "react";

export default function StepHeading({ step, children, id }) {
  return (
    <div className="lab-step-heading" id={id}>
      <span className="lab-step-badge" aria-hidden="true">{step}</span>
      <span className="lab-step-heading-text">{children}</span>
    </div>
  );
}
