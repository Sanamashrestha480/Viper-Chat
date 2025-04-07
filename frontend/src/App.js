import "./App.css";
import { BrowserRouter as Router, Switch, Route } from "react-router-dom";
import ChatPage from "./Pages/ChatPage";
import HomePage from "./Pages/HomePage";
import { ChatState } from "./Context/ChatProvider";

function App() {
  return (
    <Router>
      <div className="App">
        <Switch>
          <Route exact path="/" component={HomePage} />
          <Route path="/chats" component={ChatPage} />
        </Switch>
      </div>
    </Router>
  );
}

export default App;