import {
  Box,
  Typography,
  Grid,
  Card,
  CardMedia,
  CardContent,
  Button,
} from "@mui/material";
import "./FeaturedSection.scss";
import Image2 from "../../../assets/games/home-2.avif";
import Image3 from "../../../assets/games/home-3.avif";
import Image4 from "../../../assets/games/home-4.avif";

const featuredGames = [
  {
    title: "Python Adventures",
    image: Image2,
  },
  {
    title: "JavaScript Legends",
    image: Image3,
  },
  {
    title: "GenAI Quest",
    image: Image4,
  },
  {
    title: "Java Warriors",
    image: Image2,
  },
];

const FeaturedSection = () => {
  return (
    <Box className="featured-section">
      <Typography variant="h4" className="featured-title">
        Featured Courses
      </Typography>

      <Grid container spacing={3} className="featured-grid">
        {featuredGames.map((game) => (
          <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={game.title}>
            <Card className="game-card">
              <div className="image-wrapper">
                <CardMedia
                  component="img"
                  image={game.image}
                  alt={game.title}
                />
              </div>

              <CardContent className="card-body">
                <Typography variant="h6" className="game-title">
                  {game.title}
                </Typography>

                <div className="card-spacer" />

                <Button variant="outlined" fullWidth className="learn-btn">
                  Learn More
                </Button>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default FeaturedSection;
