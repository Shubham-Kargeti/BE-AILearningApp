import React from "react";
import { Box, Typography } from "@mui/material";
import "./StreakContainer.scss";
import MilitaryTechIcon from "@mui/icons-material/MilitaryTech";
import LocalPoliceIcon from "@mui/icons-material/LocalPolice";
import VerifiedIcon from "@mui/icons-material/Verified";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { useMidnightCountdown } from "../../custom/customTimerHook";

const rewards = [
  {
    range: "Days 1–3",
    description: "Small Coin Pack (100 coins)",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBPiRpfXqmV4n_pC2jBHOlhrJWizh_f9HLNRhYv4Q8sSqAwwfkD13MPVDEn_wh14zzzo5uQFoi2LZ1S-o2Q6syx2YuDM75kOriQOA_aBtouVOLlQZCMb4MWBoiEd_JWZrD1dWuHGLumbvgDE8m-nIodCCWKXPIDOtpdRHxZ7Cv5hn2UL8fJJZ9hw2r58CUiKcsSksSITzuoEqO_a92RWx6yw5rnjco4KdQ0XWh27gPnrMDImBpLzCY9c53FmAmk3KFGYgoK-runLoQ",
    active: false,
  },
  {
    range: "Days 4–7",
    description: "Medium Coin Pack + XP Boost",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCfE5K12lKqaJG4USluSWt8X7gnydi4us2uPo0CqmTU4CUc-q6MRGvi_n3mzlAMD1ienyRjrj3XIY2T7JXn3b2dPiLeOzS626hgm7cuDIZzq3xiXibmWWH71pHentb0MrmOdvPFnHK_a8QXixrBkFA8uUg5n8WGWCeaw7vc3yyCIeB-wSuI-ogic6MMijnLORafVY4rxL_dEpy-AzwcvXBdhq3yWEARBJBclOAOKEUmGpVcKskHl7eSKk2PYUAsXs52TQF4PlrJum0",
    active: true,
  },
  {
    range: "Days 8–14",
    description: "Large Gem Pack",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBhq2OxgeoZDcH44q_7DcE5U9m6ZEw_NDRMTJa-6GDQjrtpNpm1FluGrtfgPNd2Ylkx8y57sb3MLGGrzTx6u81OTh3T3HsXBTQAe07wzGAFLRDI9FYSINUS-kvdx5k7rr2e0yFRdrGpDmUJwcMbaP6N1_oV6Zb0saHBYeDQgExd3Ps94Tmy5NaRlz5bef308XHCBo-bI2VN18qiFBayyYfDTbs7uTyVZwCe0mTq59aUbcWS-7sg6cXJXgFILn9KLK1mvY93tAaFvyA",
    active: false,
  },
  {
    range: "Days 15+",
    description: "Mystery Reward Box",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuB0sD0R5wo4u_5dZqnBvWBoXWZi-UQAhfxbAl2fnIwFn8HbMc32lYM5k2Gz5Mx8BYA7a4-LnduMrr5ZKFlujfruo2fY3qWxE-Lamcn_qP8ZDcwmPUv0EsgER9PKuV_y5Tpk95F42HPbbV79uQEZ-w4h6C3b31Y8ct5LKcFoCnhcXx65HXzsF2hxM7tbpqCB5zMIF76oARyHwchKQZXWe1_VczH4nxYMBuCbLdPGuVP2ed7lEmpud-onJ9ikFqbINVAoYiCKlcRZKEc",
    active: false,
  },
];

const milestones = [
  { title: "7-Day Badge", unlocked: true, icon: <MilitaryTechIcon /> },
  { title: "30-Day Badge", unlocked: false, icon: <LocalPoliceIcon /> },
  { title: "100-Day Badge", unlocked: false, icon: <VerifiedIcon /> },
];

const StreakContainer: React.FC = () => {
  const timeLeft = useMidnightCountdown();

  return (
    <Box className="streak-page">
      <Typography className="page-title">Daily Streak Rewards</Typography>

      <Box className="streak-grid">
        <Box className="left-section">
          {/* Current Streak */}
          <Box className="card streak-card">
            <Box className="row">
              <Typography className="card-title">Current Streak</Typography>
              <Typography className="card-streak">5 Days</Typography>
            </Box>
            <Box className="progress-bar">
              <Box className="progress-fill" style={{ width: "71%" }} />
            </Box>
            <Typography className="card-sub">
              You're on a roll! Next reward unlocks at 7 days.
            </Typography>
          </Box>

          {/* Streak Rewards */}
          <Box className="card rewards-card">
            <Typography className="section-title">Streak Rewards</Typography>
            <Typography className="section-sub">
              Keep your streak alive to earn bigger rewards.
            </Typography>

            <Box className="rewards-grid">
              {rewards.map((item) => (
                <Box
                  key={item.range}
                  className={`reward-row ${item.active ? "active" : ""}`}
                >
                  <Box className="reward-text">
                    <p className="reward-range">{item.range}</p>
                    <p className="reward-desc">{item.description}</p>
                  </Box>
                  <Box
                    className="reward-img"
                    style={{ backgroundImage: `url(${item.image})` }}
                  />
                </Box>
              ))}
            </Box>
          </Box>

          {/* FAQs */}
          <details className="faq">
            <summary>
              <p>How It Works</p>
              <span className="material-symbols-outlined">
                <KeyboardArrowDownIcon />
              </span>
            </summary>
            <p className="faq-text">
              Play at least one game per day to maintain your streak.
            </p>
          </details>

          <details className="faq">
            <summary>
              <p>Streak Freeze</p>
              <span className="material-symbols-outlined">
                <KeyboardArrowDownIcon />
              </span>
            </summary>
            <p className="faq-text">
              A Streak Freeze protects your streak for one full day.
            </p>
          </details>
        </Box>

        <Box className="right-section">
          <Box className="card">
            <Typography className="section-title">Daily Reset Time</Typography>
            <Typography className="reset-time">{timeLeft}</Typography>
            <Typography className="section-sub">
              Time until your next daily activity reset.
            </Typography>
          </Box>

          {/* Milestones */}
          <Box className="card">
            <Typography className="section-title">Streak Milestones</Typography>
            <Typography className="section-sub">
              Unlock permanent badges for major milestones.
            </Typography>

            <Box className="milestones-list">
              {milestones.map((m) => (
                <Box
                  key={m.title}
                  className={`milestone-row ${
                    m.unlocked ? "unlocked" : "locked"
                  }`}
                >
                  <Box className="milestone-icon">
                    <span className="material-symbols-outlined">{m.icon}</span>
                  </Box>
                  <Box className="milestone-text">
                    <p className="milestone-title">{m.title}</p>
                    <p className="milestone-status">
                      {m.unlocked ? "Unlocked" : "Locked"}
                    </p>
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default StreakContainer;
