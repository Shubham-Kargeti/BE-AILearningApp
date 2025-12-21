import React from "react";
import QuestionnaireConfig, {
    type QuestionDistribution,
} from "./QuestionnaireConfig";
import AdditionalScreeningQuestions from "./AdditionalScreeningQuestions";
import CutoffMarks from "./CutoffMarks";

interface Props {
    questionDistribution: QuestionDistribution;
    onQuestionDistributionChange: (v: QuestionDistribution) => void;

    screeningQuestions: string[];
    onScreeningQuestionsChange: (v: string[]) => void;

    cutoffMarks: number;
    onCutoffMarksChange: (v: number) => void;
}


const AssessmentConfigurationBlock: React.FC<Props> = ({
    questionDistribution,
    onQuestionDistributionChange,
    screeningQuestions,
    onScreeningQuestionsChange,
    cutoffMarks,
    onCutoffMarksChange,
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
                <QuestionnaireConfig
                    value={questionDistribution}
                    onChange={onQuestionDistributionChange}
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
