import { Box, Typography, Grid, Avatar } from "@mui/material";
import StarIcon from "@mui/icons-material/Star";
import StarHalfIcon from "@mui/icons-material/StarHalf";
import "./CommunitySection.scss";

const testimonials = [
  {
    name: "Puneet Banga",
    image: "/assets/avatars/user1.jpg",
    rating: 5,
    text: "The community here is incredible. I've made more friends on this platform in a month than years on others. Truly game-changing.",
  },
  {
    name: "Arjun Singha",
    image: "/assets/avatars/user2.jpg",
    rating: 4.5,
    text: "Finally, a platform that just works. Seamless cross-play is a dream. Highly recommended.",
  },
  {
    name: "Pintoo",
    image: "/assets/avatars/user3.jpg",
    rating: 5,
    text: "Exclusive content and progression system keeps me coming back. Always something to achieve!",
  },
];

const CommunitySection = () => {
  return (
    <Box className="community-section">
      <Typography variant="h4" className="community-title">
        Join Our Thriving Community
      </Typography>

      <Grid container spacing={4} className="testimonial-grid">
        {testimonials.map((t) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={t.name}>
            <Box className="testimonial-card">
              <Box className="testimonial-header">
                <Avatar src={t.image} className="testimonial-avatar" />
                <Box>
                  <Typography className="testimonial-name">{t.name}</Typography>
                  <Box className="testimonial-stars">
                    {Array.from({ length: Math.floor(t.rating) }).map(
                      (_, i) => (
                        <StarIcon key={i} className="star" />
                      )
                    )}
                    {t.rating % 1 !== 0 && <StarHalfIcon className="star" />}
                  </Box>
                </Box>
              </Box>

              <Typography className="testimonial-text">{t.text}</Typography>
            </Box>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default CommunitySection;
