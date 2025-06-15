
// === Frontend: App.jsx ===
import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

const socket = io('https://d97a-103-181-62-119.ngrok-free.app',{
    transports: ['websocket'],
});

function App() {
  const localVideo = useRef(null);
  const remoteVideo = useRef(null);
  const peerConnection = useRef(null);
  const [myId, setMyId] = useState('');
  const [remoteUserId, setRemoteUserId] = useState('');
  const [registered, setRegistered] = useState(false);
  const [callerId, setCallerId] = useState(null);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
      localVideo.current.srcObject = stream;
      peerConnection.current = new RTCPeerConnection();

      stream.getTracks().forEach(track => {
        peerConnection.current.addTrack(track, stream);
      });

      peerConnection.current.ontrack = ({ streams: [stream] }) => {
        remoteVideo.current.srcObject = stream;
      };
    });

    socket.on('call-made', async data => {
      setCallerId(data.from);
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await peerConnection.current.createAnswer();
      await peerConnection.current.setLocalDescription(answer);
      socket.emit('make-answer', { answer, to: data.from });
    });

    socket.on('answer-made', async data => {
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.answer));
    });
  }, []);

  const registerMyId = () => {
    if (!myId) return alert('Please enter your ID');
    socket.emit('register-user', myId);
    setRegistered(true);
  };

  const callUser = async () => {
    const offer = await peerConnection.current.createOffer();
    await peerConnection.current.setLocalDescription(offer);

    socket.emit('call-user', {
      offer,
      to: remoteUserId
    });
  };

  return (
    <div>
      <h1>React Video Call</h1>
      <div>
        <input
          type="text"
          placeholder="Your ID"
          value={myId}
          onChange={e => setMyId(e.target.value)}
        />
        <button onClick={registerMyId}>Register</button>
      </div>

      {registered && (
        <div style={{ marginTop: '1rem' }}>
          <input
            type="text"
            placeholder="Enter user ID to call"
            value={remoteUserId}
            onChange={e => setRemoteUserId(e.target.value)}
          />
          <button onClick={callUser}>Call</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
        <video ref={localVideo} autoPlay muted playsInline style={{ width: '300px' }} />
        <video ref={remoteVideo} autoPlay playsInline style={{ width: '300px' }} />
      </div>
    </div>
  );
}

export default App;
