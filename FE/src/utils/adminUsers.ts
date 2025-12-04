// Temporary admin emails list — replace with backend later
export const adminUsers = [
  "shubham.kargeti@nagarro.com",
  "monesh.sanvaliya@nagarro.com",
];

// Helper function to check if user is admin
export const isAdmin = (email: string) => {
  return adminUsers.includes(email.toLowerCase());
};
