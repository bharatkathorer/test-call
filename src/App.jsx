// App.jsx
import {Link, Route, Routes} from 'react-router-dom'
import CallPage from "./CallPage.jsx";

function App() {
  return (
    <div>
      <Routes>
        <Route path="/" element={<CallPage />} />
      </Routes>
    </div>
  )
}

export default App
