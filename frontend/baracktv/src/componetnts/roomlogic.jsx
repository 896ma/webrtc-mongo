import React, { useRef, useEffect } from "react";
import io from "socket.io-client";
import ButtonComponent from "./buttons";
import { useParams } from "react-router-dom";

const RoomLogic = () => {
    const { roomID } = useParams();
    const userVideo = useRef();
    const partnerVideo = useRef();
    const peerRef = useRef();
    const socketRef = useRef();
    const otherUser = useRef();
    const userStream = useRef();

    useEffect(() => {
        navigator.mediaDevices.getUserMedia({ audio: true, video: true }).then(stream => {
            userVideo.current.srcObject = stream;
            userStream.current = stream;

            socketRef.current = io.connect("http://localhost:3000");
            socketRef.current.emit("join room", roomID);

            socketRef.current.on('other user', userID => {
                // Only call the user if they haven't been called already
                if (!peerRef.current) {
                    callUser(userID);
                    otherUser.current = userID;
                }
            });

            socketRef.current.on("user joined", userID => {
                otherUser.current = userID;
            });

            socketRef.current.on("offer", handleReceiveCall);

            socketRef.current.on("answer", handleAnswer);

            socketRef.current.on("ice-candidate", handleNewICECandidateMsg);
        });

    }, []);

    function callUser(userID) {
        peerRef.current = createPeer(userID);
        userStream.current.getTracks().forEach(track => peerRef.current.addTrack(track, userStream.current));
    }

    function createPeer(userID) {
        const peer = new RTCPeerConnection({
            iceServers: [
                {
                    urls: "stun:stun.l.google.com:19302"
                },
                {
                    urls: 'turn:numb.viagenie.ca',
                    credential: 'muazkh',
                    username: 'webrtc@live.com'
                },
            ]
        });

        peer.onicegatheringstatechange = function() {
            console.log("ICE gathering state changed: " + peer.iceGatheringState);
        }
        peer.onicecandidate = handleICECandidateEvent;
        peer.ontrack = handleTrackEvent;
        peer.onnegotiationneeded = () => handleNegotiationNeededEvent(userID);

        return peer;
    }

    async function handleNegotiationNeededEvent(userID) {
        try {
            const offer = await peerRef.current.createOffer();
            await peerRef.current.setLocalDescription(offer);
            const payload = {
                target: userID,
                caller: socketRef.current.id,
                sdp: peerRef.current.localDescription
            };
            socketRef.current.emit("offer", payload);
        } catch (e) {
            console.log("an error occured", e);
        }
    }

    async function handleReceiveCall(incoming) {
        try {
            if (!peerRef.current) {
                peerRef.current = createPeer();
            }
            const desc = new RTCSessionDescription(incoming.sdp);
            await peerRef.current.setRemoteDescription(desc);
            userStream.current.getTracks().forEach(track => peerRef.current.addTrack(track, userStream.current));
            const answer = await peerRef.current.createAnswer();
            await peerRef.current.setLocalDescription(answer);
            const payload = {
                target: incoming.caller,
                caller: socketRef.current.id,
                sdp: peerRef.current.localDescription
            };
            socketRef.current.emit("answer", payload);
        } catch (error) {
            console.error(error);
        }
    }

    function handleAnswer(message) {
        const desc = new RTCSessionDescription(message.sdp);
        peerRef.current.setRemoteDescription(desc).catch(e => console.log(e));
    }

    function handleICECandidateEvent(e) {
        if (e.candidate) {
            const payload = {
                target: otherUser.current,
                candidate: e.candidate,
            }
            socketRef.current.emit("ice-candidate", payload);
        }
    }

    function handleNewICECandidateMsg(incoming) {
        const candidate= new RTCIceCandidate(incoming);

        peerRef.current.addIceCandidate(candidate)
            .catch(e => console.log(e));
    }

    function handleTrackEvent(e) {
        partnerVideo.current.srcObject = e.streams[0];
    };
    
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'row', // Change to 'row' to display videos side by side
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            backgroundColor: '#333'
        }}>
            <video style={{ borderRadius: '15px', margin: '10px', width: '50%' }} autoPlay ref={userVideo} />
            <video style={{ borderRadius: '15px', margin: '10px', width: '50%' }} autoPlay ref={partnerVideo} />
            <ButtonComponent />
        </div>
    );
};

export default RoomLogic;
