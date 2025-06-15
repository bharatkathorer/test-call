import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import { useSearchParams } from 'react-router-dom';

const socket = io('https://dc90-103-181-62-119.ngrok-free.app', {
  transports: ['websocket'],
});

export default function CallPage() {
  const localVideo = useRef(null);
  const remoteVideo = useRef(null);
  const peerConnection = useRef(null);

  const [searchParams] = useSearchParams();
  const myId = searchParams.get('myId');
  const remoteUserId = searchParams.get('remoteUserId');

  const [localStream, setLocalStream] = useState(null);
  const [hasRemoteStream, setHasRemoteStream] = useState(false);

  useEffect(() => {
    // Get local media stream
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
      if (localVideo.current) {
        localVideo.current.srcObject = stream;
      }

      setLocalStream(stream);

      const pc = new RTCPeerConnection();
      peerConnection.current = pc;

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      pc.ontrack = (event) => {
        const remoteStream = event.streams[0];
        if (!remoteVideo.current.srcObject) {
          remoteVideo.current.srcObject = remoteStream;
          remoteVideo.current.onloadedmetadata = () => {
            remoteVideo.current
              .play()
              .then(() => console.log("Remote video started"))
              .catch((e) => console.warn("Autoplay failed:", e));
          };
          setHasRemoteStream(true);
        }
      };

      if (myId) {
        socket.emit('register-user', myId);
      }
    });
  }, []);

  useEffect(() => {
    if (!peerConnection.current) return;

    socket.on('call-made', async ({ offer, from }) => {
      console.log("Call received from:", from);
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnection.current.createAnswer();
      await peerConnection.current.setLocalDescription(answer);
      socket.emit('make-answer', { answer, to: from });
    });

    socket.on('answer-made', async ({ answer }) => {
      console.log("Answer received");
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socket.on('user-registered', (userId) => {
      if (userId === remoteUserId && localStream) {
        console.log("Calling remote user", remoteUserId);
        callUser(remoteUserId);
      }
    });

    return () => {
      socket.off('call-made');
      socket.off('answer-made');
      socket.off('user-registered');
    };
  }, [localStream]);

  const callUser = async (userId) => {
    const offer = await peerConnection.current.createOffer();
    await peerConnection.current.setLocalDescription(offer);
    socket.emit('call-user', {
      offer,
      to: userId,
    });
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>WebRTC Video Call</h2>
      <p><b>My ID:</b> {myId}</p>
      <p><b>Calling:</b> {remoteUserId || "Waiting..."}</p>

      <div style={{ display: 'flex', gap: 20 }}>
        <video
          ref={localVideo}
          autoPlay
          playsInline
          muted
          width={300}
          style={{ backgroundColor: '#000', border: '2px solid green' }}
        />
        <video
          ref={remoteVideo}
          autoPlay
          playsInline
          width={300}
          style={{ backgroundColor: '#000', border: '2px solid red' }}
        />
      </div>

      {hasRemoteStream ? (
        <p style={{ color: 'green' }}>✅ Connected to remote stream</p>
      ) : (
        <p style={{ color: 'gray' }}>⌛ Waiting for remote stream...</p>
      )}
    </div>
  );
}
