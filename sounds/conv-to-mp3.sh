#!/bin/bash
for file in *.wav
do
	name=${file##*/}
	base=${name%.wav}
	lame ${base}.wav ../public/sounds/${base}.mp3 --preset standard
done
