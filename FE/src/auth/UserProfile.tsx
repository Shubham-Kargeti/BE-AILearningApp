import { Box, Typography } from "@mui/material";
import { useMsal } from "@azure/msal-react";

/**
 * Displays identity data directly from the active MSAL account.
 * It intentionally does not duplicate the account in localStorage, Redux, or a custom context.
 */
const UserProfile = () => {
  const { instance, accounts } = useMsal();
  const account = instance.getActiveAccount() ?? accounts[0];

  if (!account) return null;

  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography fontWeight={700} noWrap title={account.name ?? "Nagarro user"}>
        Name: {account.name ?? "Nagarro user"}
      </Typography>
      <Typography variant="body2" noWrap title={account.username}>
        Email: {account.username}
      </Typography>
      {/* <Typography variant="caption" noWrap title={account.tenantId}>
        Tenant: {account.tenantId}
      </Typography> */}
    </Box>
  );
};

export default UserProfile;

