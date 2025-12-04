export const convertProficiency = (level: string) => {
  switch (level) {
    case "Beginner":
      return "Basic";
    case "Intermediate":
      return "Intermediate";
    case "Advanced":
      return "Advanced";
  }
};
