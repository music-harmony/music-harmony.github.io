var audioContext = null;
var player = null;
var isPlaying = false;
var reverberator = null;
var equalizer = null;
var songStart = 0;
var input = null;
var currentSongTime = 0;
var nextStepTime = 0;
var loadedsong = null;
var loadedsongmelody = null;
var midiChords = [
    [48,52,55],
    [55,59,62],
    [50,54,57],
    [57,61,64],
    [52,56,59],
    [59,63,66],
    [54,58,61],
    [49,53,56],
    [56,60,63],
    [51,55,58],
    [58,62,65],
    [53,57,60],
    // minor half
    [57,60,64],
    [52,55,59],
    [59,62,66],
    [54,57,61],
    [61,64,68],
    [56,59,63],
    [51,54,58],
    [58,61,65],
    [53,56,60],
    [48,51,55],
    [55,58,62],
    [50,53,57],
];

function start_player() {
    currentSongTime = 0;
    songStart = audioContext.currentTime;
    nextStepTime = audioContext.currentTime;
    var stepDuration = 44 / 1000;
    var chords = selectedChords.map(function(chord_index, i){
        if (chord_index === null){
            var chord_notes = null;
        } else {
            var chord_notes = midiChords[chord_index];
        }
        return {notes: chord_notes, 
                duration: currentMelody.chordsDuration[i]};
    });
    chordnotes = make_midi_chord_line(chords);
    newnotes = loadedsongmelody.concat(chordnotes);
    loadedsong.tracks[0].notes = newnotes;
    isPlaying = true;
    tick(loadedsong, stepDuration);
}

function stop_player(){
    isPlaying = false;
    player.cancelQueue(audioContext);
}
function tick(song, stepDuration) {
    if (!isPlaying){
        return;
    }
    if (audioContext.currentTime > nextStepTime - stepDuration) {
        sendNotes(song, songStart, currentSongTime, currentSongTime + stepDuration, audioContext, input, player);
        currentSongTime = currentSongTime + stepDuration;
        nextStepTime = nextStepTime + stepDuration;
        if (currentSongTime > song.duration) {
            isPlaying = false;
            return
        }
    }
    window.requestAnimationFrame(function (t) {
        tick(song, stepDuration);
    });
}

function make_midi_chord_line(chords){
    notes = [];
    noteIndex = 0;
    var time = 0.0;
    for(let c = 0; c < chords.length; c++){
        chord = chords[c];
        if (chord.notes !== null){
            for(let i = 0; i < chord.notes.length; i++){
                pitch = chord.notes[i];
                notes[noteIndex] = {"when": time, "pitch": pitch, "duration": chord.duration/4.0, "slides": []};
                noteIndex++;
            }
        }
        time += chord.duration/4.0;
    }
    return notes;
}

function sendNotes(song, songStart, start, end, audioContext, input, player) {
    for (var t = 0; t < song.tracks.length; t++) {
        var track = song.tracks[t];
        for (var i = 0; i < track.notes.length; i++) {
            if (track.notes[i].when >= start && track.notes[i].when < end) {
                var when = songStart + track.notes[i].when;
                var duration = track.notes[i].duration;
                if (duration > 3) {
                    duration = 3;
                }
                var instr = track.info.variable;
                var v = track.volume / 7;
                player.queueWaveTable(audioContext, input, window[instr], when, track.notes[i].pitch, duration, v, track.notes[i].slides);
            }
        }
    }
    for (var b = 0; b < song.beats.length; b++) {
        var beat = song.beats[b];
        for (var i = 0; i < beat.notes.length; i++) {
            if (beat.notes[i].when >= start && beat.notes[i].when < end) {
                var when = songStart + beat.notes[i].when;
                var duration = 1.5;
                var instr = beat.info.variable;
                var v = beat.volume / 2;
                player.queueWaveTable(audioContext, input, window[instr], when, beat.n, duration, v);
            }
        }
    }
}

function startLoad(song) {
    var AudioContextFunc = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioContextFunc();
    player = new WebAudioFontPlayer();

    equalizer = player.createChannel(audioContext);
    reverberator = player.createReverberator(audioContext);
    input = equalizer.input;
    equalizer.output.connect(reverberator.input);
    reverberator.output.connect(audioContext.destination);

    for (var i = 0; i < song.tracks.length; i++) {
        var nn = player.loader.findInstrument(song.tracks[i].program);
        var info = player.loader.instrumentInfo(nn);
        song.tracks[i].info = info;
        song.tracks[i].id = nn;
        player.loader.startLoad(audioContext, info.url, info.variable);
    }
    for (var i = 0; i < song.beats.length; i++) {
        var nn = player.loader.findDrum(song.beats[i].n);
        var info = player.loader.drumInfo(nn);
        song.beats[i].info = info;
        song.beats[i].id = nn;
        player.loader.startLoad(audioContext, info.url, info.variable);
    }
    player.loader.waitLoad(function () {
        loadedsong = song;
        loadedsongmelody = song.tracks[0].notes;
    });
}

function load_midi_file(filename) {
    var req = new XMLHttpRequest();
    req.onload = function(){
        var fileReader = new FileReader();
        fileReader.onload = function (progressEvent) {
            var arrayBuffer = progressEvent.target.result;
            var midiFile = new MIDIFile(arrayBuffer);
            var song = midiFile.parseSong();
            startLoad(song);
        };
        fileReader.readAsArrayBuffer(req.response);
    };
    req.open('GET', filename);
    req.responseType = "blob";
    req.send();

}

