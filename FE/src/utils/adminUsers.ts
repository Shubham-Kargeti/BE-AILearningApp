export const adminUsers = [
  "admin@nagarro.com",
];

export const isAdmin = (email: string) => {
  return adminUsers.includes(email.toLowerCase());
};
