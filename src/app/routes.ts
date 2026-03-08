import { createBrowserRouter } from "react-router";
import LoadingScreen from "./components/LoadingScreen";
import WelcomeScreen from "./components/WelcomeScreen";
import InterestSelection from "./components/InterestSelection";
import EventFeed from "./components/EventFeed";
import DiscoverMap from "./components/DiscoverMap";
import EventDetails from "./components/EventDetails";
import AIAssistant from "./components/AIAssistant";
import Profile from "./components/Profile";

export const router = createBrowserRouter([
  {
    path: "/",
    children: [
      { index: true, Component: LoadingScreen },
      { path: "welcome", Component: WelcomeScreen },
      { path: "interests", Component: InterestSelection },
      { path: "feed", Component: EventFeed },
      { path: "discover", Component: DiscoverMap },
      { path: "event/:id", Component: EventDetails },
      { path: "assistant", Component: AIAssistant },
      { path: "profile", Component: Profile },
    ],
  },
]);