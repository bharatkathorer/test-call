import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import { useSearchParams } from 'react-router-dom';

// Use your deployed Socket.IO server over HTTPS if in production
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

  // 🎥 Initialize local media & PeerConnection
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((stream) => {
        console.log('✅ Local stream ready', stream);
        localVideo.current.srcObject = stream;
        setLocalStream(stream);

        const pc = new RTCPeerConnection();
        peerConnection.current = pc;

        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
        console.log('🔗 Added local tracks:', stream.getTracks());

        pc.ontrack = (evt) => {
          console.log('🟣 ontrack event:', evt);
          const [remoteStream] = evt.streams;
          console.log('🟣 remoteStream tracks:', remoteStream?.getTracks());

          if (remoteStream && !remoteVideo.current.srcObject) {
            remoteVideo.current.srcObject = remoteStream;
            setHasRemoteStream(true);

            remoteVideo.current.onloadedmetadata = () => {
              remoteVideo.current.play()
                .then(() => console.log('✅ Remote video playing'))
                .catch((e) => console.warn('⚠️ Remote play failed:', e));
            };
          }
        };

        if (myId) {
          socket.emit('register-user', myId);
          console.log('📡 Registering user:', myId);
        }
      })
      .catch((err) => console.error('❌ getUserMedia error:', err));
  }, []);

  // 🧠 Socket event handling
  useEffect(() => {
    if (!peerConnection.current) return;

    socket.on('user-registered', (userId) => {
      console.log('📶 user-registered', userId);
      if (userId === remoteUserId && localStream) {
        console.log('📞 Initiating call to', remoteUserId);
        callUser(remoteUserId);
      }
    });

    socket.on('call-made', async ({ offer, from }) => {
      console.log('📥 call-made from', from);
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnection.current.createAnswer();
      await peerConnection.current.setLocalDescription(answer);
      socket.emit('make-answer', { answer, to: from });
      console.log('📤 Answer sent');
    });

    socket.on('answer-made', async ({ answer }) => {
      console.log('📥 answer-made received');
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
    });

    return () => {
      socket.off('user-registered');
      socket.off('call-made');
      socket.off('answer-made');
    };
  }, [localStream, remoteUserId]);

  // 🔔 Offer creation & emit
  const callUser = async (userId) => {
    console.log('📤 createOffer to', userId);
    const offer = await peerConnection.current.createOffer();
    await peerConnection.current.setLocalDescription(offer);
    socket.emit('call-user', { offer, to: userId });
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>🔴 WebRTC Video Call</h2>
      <p><strong>Your ID:</strong> {myId}</p>
      <p><strong>Calling:</strong> {remoteUserId || '—'}</p>

      <div style={{ display: 'flex', gap: 20, marginTop: 20 }}>
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

      <p style={{ color: hasRemoteStream ? 'green' : 'gray', marginTop: 10 }}>
        {hasRemoteStream ? '✅ Remote Stream Active' : '⌛ Waiting for remote stream...'}
      </p>
    </div>
  );
}
