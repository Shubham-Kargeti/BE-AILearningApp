import React from "react";
import { Box, Typography, Paper, LinearProgress, Chip } from "@mui/material";
import "./StreakContainer.scss";
import MilitaryTechIcon from "@mui/icons-material/MilitaryTech";
import LocalPoliceIcon from "@mui/icons-material/LocalPolice";
import VerifiedIcon from "@mui/icons-material/Verified";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import WhatshotIcon from "@mui/icons-material/Whatshot";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import LockIcon from "@mui/icons-material/Lock";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
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
  const currentStreak = 5;
  const progress = (currentStreak / 7) * 100;

  return (
    <Box sx={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      paddingBottom: '4rem'
    }}>
      {/* Header */}
      <Box sx={{
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
        padding: '3rem 2rem',
        marginBottom: '2rem'
      }}>
        <Box sx={{ maxWidth: '1400px', margin: '0 auto' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
            <WhatshotIcon sx={{ fontSize: 48, color: '#fbbf24' }} />
            <Typography variant="h3" sx={{
              fontWeight: 800,
              color: 'white',
              textShadow: '0 2px 10px rgba(0,0,0,0.1)'
            }}>
              Daily Streak Rewards 🔥
            </Typography>
          </Box>
          <Typography variant="h6" sx={{
            color: 'rgba(255,255,255,0.9)',
            fontWeight: 400
          }}>
            Keep your streak alive to unlock amazing rewards and badges
          </Typography>
        </Box>
      </Box>

      {/* Content */}
      <Box sx={{ maxWidth: '1400px', margin: '0 auto', padding: '0 2rem' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' }, gap: '2rem' }}>
          
          {/* Left Section */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            {/* Current Streak Card */}
            <Paper sx={{
              padding: '2.5rem',
              borderRadius: '24px',
              background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
              boxShadow: '0 8px 32px rgba(251, 191, 36, 0.3)',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <Box sx={{ position: 'relative', zIndex: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: 'white' }}>
                    Current Streak
                  </Typography>
                  <Box sx={{
                    background: 'rgba(255,255,255,0.3)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: '16px',
                    padding: '0.5rem 1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <WhatshotIcon sx={{ color: 'white', fontSize: 28 }} />
                    <Typography sx={{ fontSize: '2rem', fontWeight: 800, color: 'white' }}>
                      {currentStreak}
                    </Typography>
                    <Typography sx={{ fontSize: '1rem', fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
                      Days
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ marginBottom: '0.75rem' }}>
                  <LinearProgress 
                    variant="determinate" 
                    value={progress}
                    sx={{
                      height: '12px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(255,255,255,0.3)',
                      '& .MuiLinearProgress-bar': {
                        backgroundColor: 'white',
                        borderRadius: '10px'
                      }
                    }}
                  />
                </Box>

                <Typography sx={{ fontSize: '0.9375rem', color: 'white', fontWeight: 500 }}>
                  🎉 You're on a roll! Next reward unlocks at 7 days.
                </Typography>
              </Box>
              
              <Box sx={{
                position: 'absolute',
                top: '-50px',
                right: '-50px',
                width: '200px',
                height: '200px',
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '50%',
                filter: 'blur(40px)'
              }} />
            </Paper>

            {/* Streak Rewards */}
            <Paper sx={{
              padding: '2.5rem',
              borderRadius: '24px',
              backgroundColor: 'white',
              boxShadow: '0 8px 32px rgba(0,0,0,0.08)'
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <EmojiEventsIcon sx={{ fontSize: 32, color: '#667eea' }} />
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#0f172a' }}>
                  Streak Rewards
                </Typography>
              </Box>
              <Typography sx={{ color: '#64748b', marginBottom: '2rem', fontSize: '0.9375rem' }}>
                Keep your streak alive to earn bigger rewards
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {rewards.map((item) => (
                  <Box
                    key={item.range}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '1.25rem',
                      borderRadius: '16px',
                      border: item.active ? '2px solid #667eea' : '2px solid #e2e8f0',
                      background: item.active ? 'linear-gradient(135deg, #ede9fe 0%, #dbeafe 100%)' : '#f8fafc',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'translateX(4px)',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.08)'
                      }
                    }}
                  >
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                        <Chip 
                          label={item.range}
                          size="small"
                          sx={{
                            background: item.active ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#cbd5e1',
                            color: 'white',
                            fontWeight: 700,
                            fontSize: '0.75rem'
                          }}
                        />
                        {item.active && (
                          <CheckCircleIcon sx={{ color: '#10b981', fontSize: 20 }} />
                        )}
                      </Box>
                      <Typography sx={{ 
                        fontWeight: 600, 
                        color: item.active ? '#4338ca' : '#64748b',
                        fontSize: '0.9375rem'
                      }}>
                        {item.description}
                      </Typography>
                    </Box>
                    <Box
                      component="img"
                      src={item.image}
                      alt={item.description}
                      sx={{
                        width: '60px',
                        height: '60px',
                        objectFit: 'contain',
                        opacity: item.active ? 1 : 0.5
                      }}
                    />
                  </Box>
                ))}
              </Box>
            </Paper>

            {/* FAQ Sections */}
            <Paper sx={{
              padding: '2.5rem',
              borderRadius: '24px',
              backgroundColor: 'white',
              boxShadow: '0 8px 32px rgba(0,0,0,0.08)'
            }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#0f172a', marginBottom: '1.5rem' }}>
                Frequently Asked Questions
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <details style={{ cursor: 'pointer' }}>
                  <summary style={{ 
                    padding: '1rem',
                    background: '#f8fafc',
                    borderRadius: '12px',
                    fontWeight: 600,
                    color: '#334155',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span>How It Works</span>
                    <KeyboardArrowDownIcon />
                  </summary>
                  <Typography sx={{ padding: '1rem', color: '#64748b', fontSize: '0.9375rem' }}>
                    Play at least one game per day to maintain your streak. Complete quizzes or assessments to keep the streak alive.
                  </Typography>
                </details>

                <details style={{ cursor: 'pointer' }}>
                  <summary style={{ 
                    padding: '1rem',
                    background: '#f8fafc',
                    borderRadius: '12px',
                    fontWeight: 600,
                    color: '#334155',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span>Streak Freeze</span>
                    <KeyboardArrowDownIcon />
                  </summary>
                  <Typography sx={{ padding: '1rem', color: '#64748b', fontSize: '0.9375rem' }}>
                    A Streak Freeze protects your streak for one full day. Use it wisely when you know you might miss a day!
                  </Typography>
                </details>
              </Box>
            </Paper>
          </Box>

          {/* Right Section */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            {/* Daily Reset Time */}
            <Paper sx={{
              padding: '2.5rem',
              borderRadius: '24px',
              backgroundColor: 'white',
              boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
              textAlign: 'center'
            }}>
              <Box sx={{
                width: '64px',
                height: '64px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.5rem'
              }}>
                <AccessTimeIcon sx={{ fontSize: 32, color: 'white' }} />
              </Box>

              <Typography variant="h6" sx={{ fontWeight: 700, color: '#0f172a', marginBottom: '1rem' }}>
                Daily Reset Time
              </Typography>
              
              <Box sx={{
                background: 'linear-gradient(135deg, #ede9fe 0%, #dbeafe 100%)',
                borderRadius: '16px',
                padding: '1.5rem',
                marginBottom: '1rem'
              }}>
                <Typography sx={{ 
                  fontSize: '2.5rem', 
                  fontWeight: 800, 
                  color: '#667eea',
                  fontFamily: 'monospace'
                }}>
                  {timeLeft}
                </Typography>
              </Box>

              <Typography sx={{ color: '#64748b', fontSize: '0.875rem' }}>
                Time until your next daily activity reset
              </Typography>
            </Paper>

            {/* Streak Milestones */}
            <Paper sx={{
              padding: '2.5rem',
              borderRadius: '24px',
              backgroundColor: 'white',
              boxShadow: '0 8px 32px rgba(0,0,0,0.08)'
            }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>
                Streak Milestones
              </Typography>
              <Typography sx={{ color: '#64748b', marginBottom: '2rem', fontSize: '0.875rem' }}>
                Unlock permanent badges for major milestones
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {milestones.map((m) => (
                  <Box
                    key={m.title}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      padding: '1.25rem',
                      borderRadius: '16px',
                      background: m.unlocked 
                        ? 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)'
                        : '#f8fafc',
                      border: m.unlocked ? '2px solid #10b981' : '2px solid #e2e8f0',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    <Box sx={{
                      width: '48px',
                      height: '48px',
                      background: m.unlocked 
                        ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                        : '#cbd5e1',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      {m.unlocked ? m.icon : <LockIcon sx={{ color: 'white', fontSize: 24 }} />}
                    </Box>

                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ 
                        fontWeight: 700, 
                        color: m.unlocked ? '#047857' : '#64748b',
                        marginBottom: '0.25rem',
                        fontSize: '0.9375rem'
                      }}>
                        {m.title}
                      </Typography>
                      <Chip
                        label={m.unlocked ? "Unlocked" : "Locked"}
                        size="small"
                        icon={m.unlocked ? <CheckCircleIcon /> : <LockIcon />}
                        sx={{
                          background: m.unlocked ? '#10b981' : '#94a3b8',
                          color: 'white',
                          fontWeight: 600,
                          fontSize: '0.75rem',
                          height: '24px',
                          '& .MuiChip-icon': {
                            color: 'white',
                            fontSize: 14
                          }
                        }}
                      />
                    </Box>
                  </Box>
                ))}
              </Box>
            </Paper>
          </Box>

        </Box>
      </Box>
    </Box>
  );
};

export default StreakContainer;
