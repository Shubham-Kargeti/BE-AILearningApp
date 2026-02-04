export const adminUsers = [
  "admin@nagarro.com",
  "shubham.kargeti@nagarro.com",
  "monesh.sanvaliya@nagarro.com",
];

export const isAdmin = (email: string) => {
  return adminUsers.includes(email.toLowerCase());
};
