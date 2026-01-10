import React from "react";
import QuestionnaireConfig, {
    type QuestionDistribution,
} from "./QuestionnaireConfig";
import AdditionalScreeningQuestions from "./AdditionalScreeningQuestions";
import CutoffMarks from "./CutoffMarks";
import TotalQuestions from "./TotalQuestions";
import DifficultyDistribution from "./DifficultyDistribution";
import ExperienceAdjustment from "./ExperienceAdjustment";

interface Props {
    questionDistribution: QuestionDistribution;
    onQuestionDistributionChange: (v: QuestionDistribution) => void;

    screeningQuestions: string[];
    onScreeningQuestionsChange: (v: string[]) => void;

    cutoffMarks: number;
    onCutoffMarksChange: (v: number) => void;

    // NEW: Experience-based configuration props
    totalQuestions: number;
    onTotalQuestionsChange: (v: number) => void;

    autoAdjustByExperience: boolean;
    onAutoAdjustByExperienceChange: (v: boolean) => void;

    difficultyDistribution: Record<string, number>;
    onDifficultyDistributionChange: (v: Record<string, number>) => void;
}


const AssessmentConfigurationBlock: React.FC<Props> = ({
    questionDistribution,
    onQuestionDistributionChange,
    screeningQuestions,
    onScreeningQuestionsChange,
    cutoffMarks,
    onCutoffMarksChange,
    totalQuestions,
    onTotalQuestionsChange,
    autoAdjustByExperience,
    onAutoAdjustByExperienceChange,
    difficultyDistribution,
    onDifficultyDistributionChange,
}) => {

    return (
        <section className="card assessment-config-card">
            <div className="card-header">
                <h2>Assessment Configuration</h2>
                <p className="hint">
                    Configure question distribution, screening criteria, and cut-off
                    marks.
                </p>
            </div>

            <div className="assessment-config-content">
                <TotalQuestions
                    value={totalQuestions}
                    onChange={onTotalQuestionsChange}
                />

                <QuestionnaireConfig
                    value={questionDistribution}
                    onChange={onQuestionDistributionChange}
                />

                <DifficultyDistribution
                    value={difficultyDistribution}
                    onChange={onDifficultyDistributionChange}
                />

                <ExperienceAdjustment
                    value={autoAdjustByExperience}
                    onChange={onAutoAdjustByExperienceChange}
                />

                <AdditionalScreeningQuestions
                    value={screeningQuestions}
                    onChange={onScreeningQuestionsChange}
                />


                <CutoffMarks
                    value={cutoffMarks}
                    onChange={onCutoffMarksChange}
                />
            </div>
        </section>
    );
};

export default AssessmentConfigurationBlock;
