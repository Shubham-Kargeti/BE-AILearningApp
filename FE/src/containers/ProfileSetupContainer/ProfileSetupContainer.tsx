import React, { useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import {
  Box,
  Button,
  TextField,
  Typography,
  Autocomplete,
  Chip,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import "./ProfileSetupContainer.scss";
import { convertProficiency } from "./helper";
import { apiCall } from "../../API";
import { GET_SUB_TOPICS } from "../../API/constants";
import Loader from "../../components/Loader";

const skillOptions = ["Agentic AI"];

const profeciencyOptions = ["Beginner", "Intermediate", "Advanced"];

interface ProfileSetupFormValues {
  role: string;
  skills: string[];
  subSkills: string[];
  expertise: string;
}

const ProfileSetupContainer = () => {
  const navigate = useNavigate();

  const [subSkillsOptions, setSubSkillsOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const formik = useFormik<ProfileSetupFormValues>({
    initialValues: {
      role: "Developer",
      skills: [],
      subSkills: [],
      expertise: "",
    },
    validationSchema: Yup.object({
      role: Yup.string().required("Role is required"),
      skills: Yup.array().min(1, "Select at least one skill"),
      subSkills: Yup.array().min(1, "Select at least one sub-skill"),
      expertise: Yup.string().required("Select your expertise level"),
    }),
    onSubmit: (values) => {
      console.log("Monesh Profile saved:", values);
      localStorage.setItem("profileCompleted", "true");

      const { expertise, skills, subSkills } = values;
      const userprofileData = {
        topic: skills[0] || "",
        subtopics: subSkills,
        level: convertProficiency(expertise) || "",
      };
      localStorage.setItem("userProfile", JSON.stringify(userprofileData));
      navigate("/quiz");
    },
  });

  const getSubTopicsBasedOnSkills = async (skills: string[]) => {
    try {
      setLoading(true);
      const res = await apiCall(`${GET_SUB_TOPICS}${skills[0]}`, "GET");
      setSubSkillsOptions(res || []);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching sub topics:", error);
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    formik.setFieldValue(field, value);
    if (field === "skills") {
      formik.setFieldValue("subSkills", []);
      getSubTopicsBasedOnSkills(value);
    }
  };

  if (loading) return <Loader fullscreen message="Loading SubSkills..." />;

  return (
    <Box className="profile-setup-page">
      <Box className="profile-main-content">
        <Typography variant="h5" className="page-title">
          Profile Setup
        </Typography>

        <form onSubmit={formik.handleSubmit} className="profile-form">
          <TextField
            id="role"
            name="role"
            label="Role"
            fullWidth
            value={formik.values.role}
            onChange={formik.handleChange}
            error={formik.touched.role && Boolean(formik.errors.role)}
            helperText={formik.touched.role && formik.errors.role}
            margin="normal"
          />

          <Autocomplete
            multiple
            id="skills"
            options={skillOptions}
            value={formik.values.skills}
            onChange={(event, value) => handleChange("skills", value)}
            renderValue={(value: readonly string[]) =>
              value.map((option: string, index: number) => (
                <Chip
                  key={index}
                  label={option}
                  onDelete={() =>
                    formik.setFieldValue(
                      "skills",
                      value.filter((_, i) => i !== index)
                    )
                  }
                />
              ))
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label="Select Skills"
                placeholder="Search or select skills"
                error={formik.touched.skills && Boolean(formik.errors.skills)}
                helperText={formik.touched.skills && formik.errors.skills}
                margin="normal"
              />
            )}
          />

          <Autocomplete
            multiple
            id="subSkills"
            options={subSkillsOptions}
            value={formik.values.subSkills}
            onChange={(event, value) => handleChange("subSkills", value)}
            renderValue={(value: readonly string[]) =>
              value.map((option: string, index: number) => (
                <Chip
                  key={index}
                  label={option}
                  onDelete={() =>
                    formik.setFieldValue(
                      "subSkills",
                      value.filter((_, i) => i !== index)
                    )
                  }
                />
              ))
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label="Select SubSkills"
                placeholder="Search or select subSkills"
                error={
                  formik.touched.subSkills && Boolean(formik.errors.subSkills)
                }
                helperText={formik.touched.subSkills && formik.errors.subSkills}
                margin="normal"
              />
            )}
          />

          <Autocomplete
            id="expertise"
            options={profeciencyOptions}
            value={formik.values.expertise}
            onChange={(event, value) =>
              formik.setFieldValue("expertise", value)
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label="Expertise Level"
                placeholder="Select expertise level"
                error={
                  formik.touched.expertise && Boolean(formik.errors.expertise)
                }
                helperText={formik.touched.expertise && formik.errors.expertise}
                margin="normal"
              />
            )}
          />

          <Button
            variant="contained"
            color="primary"
            type="submit"
            className="save-btn"
          >
            Save & Continue
          </Button>
        </form>
      </Box>
    </Box>
  );
};

export default ProfileSetupContainer;
