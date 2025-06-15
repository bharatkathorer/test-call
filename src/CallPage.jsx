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
  const [remoteStream, setRemoteStream] = useState(null);

  // Create PeerConnection only once
  useEffect(() => {
    const pc = new RTCPeerConnection();
    peerConnection.current = pc;

    pc.ontrack = (event) => {
      console.log('🔁 Remote track received', event.streams);
      const [stream] = event.streams;
      if (remoteVideo.current && !remoteStream) {
        remoteVideo.current.srcObject = stream;
        setRemoteStream(stream);
      }
    };

    return () => {
      pc.close();
    };
  }, []);

  // Get media
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((stream) => {
        if (localVideo.current) {
          localVideo.current.srcObject = stream;
        }
        setLocalStream(stream);

        // Add tracks to peer connection
        stream.getTracks().forEach((track) => {
          peerConnection.current.addTrack(track, stream);
        });

        // Register user
        if (myId) {
          socket.emit('register-user', myId);
        }
      })
      .catch((err) => console.error('Media error:', err));
  }, []);

  // Handle socket events
  useEffect(() => {
    socket.on('user-registered', (userId) => {
      if (userId === remoteUserId && localStream) {
        console.log('📞 Calling', userId);
        makeCall();
      }
    });

    socket.on('call-made', async ({ offer, from }) => {
      console.log('📥 Call offer received from', from);
      if (!peerConnection.current) return;

      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnection.current.createAnswer();
      await peerConnection.current.setLocalDescription(answer);
      socket.emit('make-answer', { answer, to: from });
    });

    socket.on('answer-made', async ({ answer }) => {
      console.log('📥 Answer received');
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
    });

    return () => {
      socket.off('user-registered');
      socket.off('call-made');
      socket.off('answer-made');
    };
  }, [localStream, remoteUserId]);

  const makeCall = async () => {
    const offer = await peerConnection.current.createOffer();
    await peerConnection.current.setLocalDescription(offer);
    socket.emit('call-user', {
      offer,
      to: remoteUserId,
    });
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>🔴 WebRTC Video Call</h2>
      <p><b>Your ID:</b> {myId}</p>
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

      <p style={{ marginTop: 10 }}>
        {remoteStream ? '✅ Remote video connected' : '⌛ Waiting for remote...'}
      </p>
    </div>
  );
}
