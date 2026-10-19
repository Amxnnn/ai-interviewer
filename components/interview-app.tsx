"use client";

import { useState } from "react";
import type { InterviewPlan, InterviewSetup } from "@/lib/interview/schema";
import type { Resume } from "@/lib/resume/schema";
import { InterviewChat } from "./interview-chat";
import { InterviewSetupForm } from "./interview-setup-form";
import { ResumeSummary } from "./resume-summary";
import { ResumeUploader } from "./resume-uploader";

// The app's flow as a state machine: upload -> setup -> interview. Each stage
// holds exactly the data it needs, so the type system makes it impossible to
// reach the interview without a resume and a plan.
type Stage =
  | { name: "upload" }
  | { name: "setup"; resume: Resume; truncated: boolean }
  | { name: "interview"; resume: Resume; setup: InterviewSetup; plan: InterviewPlan };

export function InterviewApp() {
  const [stage, setStage] = useState<Stage>({ name: "upload" });
  const restart = () => setStage({ name: "upload" });

  switch (stage.name) {
    case "upload":
      return <ResumeUploader onParsed={(resume, truncated) => setStage({ name: "setup", resume, truncated })} />;

    case "setup":
      return (
        <div className="flex flex-col gap-10">
          <InterviewSetupForm
            resume={stage.resume}
            onReady={(setup, plan) => setStage({ name: "interview", resume: stage.resume, setup, plan })}
            onBack={restart}
          />
          <ResumeSummary resume={stage.resume} truncated={stage.truncated} />
        </div>
      );

    case "interview":
      return <InterviewChat resume={stage.resume} setup={stage.setup} plan={stage.plan} onRestart={restart} />;
  }
}
