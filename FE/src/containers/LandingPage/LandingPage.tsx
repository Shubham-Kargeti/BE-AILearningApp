import Navbar from "./components/Navbar";
import HeroSection from "./components/HeroSection";
import CommunitySection from "./components/CommunitySection";
import FeaturesSection from "./components/FeaturesSection";
import Footer from "./components/Footer";
import "./LandingPage.scss";

const LandingPage = () => {
  return (
    <div className="landing-page">
      <Navbar />
      <div id="hero">
        <HeroSection />
      </div>
      {/* <div id="featured">
        <FeaturedSection />
      </div> */}
      <div id="community">
        <CommunitySection />
      </div>
      <div id="features">
        <FeaturesSection />
      </div>
      <Footer />
    </div>
  );
};

export default LandingPage;
