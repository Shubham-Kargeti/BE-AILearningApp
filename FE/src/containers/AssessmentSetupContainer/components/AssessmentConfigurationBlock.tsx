import React from "react";
import QuestionnaireConfig, {
    type QuestionDistribution,
} from "./QuestionnaireConfig";
import CutoffMarks from "./CutoffMarks";
import TotalQuestions from "./TotalQuestions";

interface Props {
    questionDistribution: QuestionDistribution;
    onQuestionDistributionChange: (v: QuestionDistribution) => void;

    cutoffMarks: number;
    onCutoffMarksChange: (v: number) => void;

    // NEW: Experience-based configuration props
    totalQuestions: number;
    onTotalQuestionsChange: (v: number) => void;

    roleCategory: "tech" | "non-tech";

}


const AssessmentConfigurationBlock: React.FC<Props> = ({
    questionDistribution,
    onQuestionDistributionChange,
    cutoffMarks,
    onCutoffMarksChange,
    totalQuestions,
    onTotalQuestionsChange,
    roleCategory,
}) => {

    return (
        <section className="card assessment-config-card">
            <div className="card-header">
                <h2>Assessment Configuration</h2>
                <p className="hint">
                    Configure question type counts and cut-off marks. Skill difficulty
                    is inferred per extracted skill.
                </p>
            </div>

            <div className="assessment-config-content">
                <TotalQuestions
                    value={totalQuestions}
                    onChange={onTotalQuestionsChange}
                />

                <QuestionnaireConfig
                    value={questionDistribution}
                    totalQuestions={totalQuestions}  
                    onChange={onQuestionDistributionChange}
                    roleCategory={roleCategory}
                />

                <CutoffMarks
                    value={cutoffMarks}
                    onChange={onCutoffMarksChange}
                    disabled={false}
                />
            </div>
        </section>
    );
};

export default AssessmentConfigurationBlock;
