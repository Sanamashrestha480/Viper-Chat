// import "./App.css";
// import { Route } from "react-router-dom";
// import ChatPage from "./Pages/ChatPage";
// import HomePage from "./Pages/HomePage";

// function App() {
//   return (
//     <div className="App">
//       <Route path="/" component={HomePage} exact />
//       <Route path="/chats" component={ChatPage} />
//     </div>
//   );
// }

// export default App;

import "./App.css";
import { Switch, Route } from "react-router-dom"; // Import Switch
import ChatPage from "./Pages/ChatPage";
import HomePage from "./Pages/HomePage";

function App() {
  return (
    <div className="App">
      <Switch>
        <Route path="/" component={HomePage} exact />
        <Route path="/chats" component={ChatPage} />
      </Switch>
    </div>
  );
}

export default App;
