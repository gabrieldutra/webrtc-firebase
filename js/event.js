import firestore from "./firebase";
import servers from "./ice";

let fluxoLocalDeDados = null;
let fluxoRemotoDeDados = null;
let pc = null;

// HTML elements
const botaoAtivarCamera = document.getElementById("botaoAtivarCamera");
const cameraLocal = document.getElementById("cameraLocal");
const botaoDeChamada = document.getElementById("botaoDeChamada");
const codigoChamada = document.getElementById("codigoChamada");
const botaoAtenderChamada = document.getElementById("botaoAtenderChamada");
const cameraParticipante = document.getElementById("cameraParticipante");
const botaoDesligar = document.getElementById("botaoDesligar");

botaoAtivarCamera.addEventListener(
  "click",
  function (el) {
    document.getElementById("homeGreeting").hidden = true;
    document.getElementById("conteudo").hidden = false;
    el.target.hidden = true;
  },
  false
);

// 1. Setup media sources

botaoAtivarCamera.onclick = async () => {
  fluxoLocalDeDados = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: false,
  });
  fluxoRemotoDeDados = new MediaStream();

  if (pc == null) {
    pc = new RTCPeerConnection(servers);
  }

  // Push tracks from local stream to peer connection
  fluxoLocalDeDados.getTracks().forEach((track) => {
    pc.addTrack(track, fluxoLocalDeDados);
  });

  // Pull tracks from remote stream, add to video stream
  pc.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      fluxoRemotoDeDados.addTrack(track);
    });
  };

  cameraLocal.srcObject = fluxoLocalDeDados;
  cameraParticipante.srcObject = fluxoRemotoDeDados;

  botaoDeChamada.disabled = false;
  botaoAtenderChamada.disabled = false;
  botaoAtivarCamera.disabled = true;
};

// 2. Create an offer
botaoDeChamada.onclick = async () => {
  const callId = codigoChamada.value;
  codigoChamada.value = "";
  if (callId) {
    const callDoc = firestore.collection("calls").doc(callId);
    await callDoc.delete();
  }

  // Reference Firestore collections for signaling
  const callDoc = firestore.collection("calls").doc();
  const offerCandidates = callDoc.collection("offerCandidates");
  const answerCandidates = callDoc.collection("answerCandidates");

  codigoChamada.value = callDoc.id;

  if (pc == null) {
    pc = new RTCPeerConnection(servers);
  }

  // Get candidates for caller, save to db
  pc.onicecandidate = (event) => {
    event.candidate && offerCandidates.add(event.candidate.toJSON());
  };

  // Create offer
  const offerDescription = await pc.createOffer();
  await pc.setLocalDescription(offerDescription);

  const offer = {
    sdp: offerDescription.sdp,
    type: offerDescription.type,
  };

  await callDoc.set({ offer });

  // Listen for remote answer
  callDoc.onSnapshot((snapshot) => {
    const data = snapshot.data();
    if (!pc.currentRemoteDescription && data?.answer) {
      const answerDescription = new RTCSessionDescription(data.answer);
      pc.setRemoteDescription(answerDescription);
    }
  });

  // When answered, add candidate to peer connection
  answerCandidates.onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        const candidate = new RTCIceCandidate(change.doc.data());
        pc.addIceCandidate(candidate);
      }
    });
  });

  botaoDesligar.disabled = false;
};

// 3. Answer the call with the unique ID
botaoAtenderChamada.onclick = async () => {
  const callId = codigoChamada.value;
  const callDoc = firestore.collection("calls").doc(callId);
  const answerCandidates = callDoc.collection("answerCandidates");
  const offerCandidates = callDoc.collection("offerCandidates");

  pc.onicecandidate = (event) => {
    event.candidate && answerCandidates.add(event.candidate.toJSON());
  };

  const callData = (await callDoc.get()).data();

  const offerDescription = callData.offer;
  await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

  const answerDescription = await pc.createAnswer();
  await pc.setLocalDescription(answerDescription);

  const answer = {
    type: answerDescription.type,
    sdp: answerDescription.sdp,
  };

  await callDoc.update({ answer });

  offerCandidates.onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      console.log(change);
      if (change.type === "added") {
        let data = change.doc.data();
        pc.addIceCandidate(new RTCIceCandidate(data));
      }
    });
  });
};

botaoDesligar.addEventListener(
  "click",
  async function (el) {
    pc.close();
    pc = null;
    const callId = codigoChamada.value;
    if (callId) {
      const callDoc = firestore.collection("calls").doc(callId);
      await callDoc.delete();
    }
  },
  false
);

window.addEventListener(
  "beforeunload",
  async function (e) {
    const callId = codigoChamada.value;
    if (callId) {
      const callDoc = firestore.collection("calls").doc(callId);
      await callDoc.delete();
    }
  },
  false
);
