#!/bin/sh
# Based on https://github.com/wooorm/dictionaries/blob/master/script/crawl.sh (MIT license)

DICTIONARIES_PATH="dictionaries"
TEMP_PATH="temp"

build() {
  local ARCHIVE_PATH="$TEMP_PATH/$1.zip"
  local SOURCE_PATH="$TEMP_PATH/$1"

  if [ ! -e "$ARCHIVE_PATH" ]; then
    wget "$2" -O "$ARCHIVE_PATH"
  fi

  if [ ! -e "$SOURCE_PATH" ]; then
    unzip "$ARCHIVE_PATH" -d "$SOURCE_PATH"
  fi

  find "$SOURCE_PATH" -name *.aff -exec cp {} "$DICTIONARIES_PATH" ";"
  find "$SOURCE_PATH" -name *.dic -exec cp {} "$DICTIONARIES_PATH" ";"
  find "$SOURCE_PATH" -name license.txt -exec cp {} "$DICTIONARIES_PATH" ";"
}

rm -r "$DICTIONARIES_PATH"
mkdir -p "$DICTIONARIES_PATH"
mkdir -p "$TEMP_PATH"

# http://extensions.openoffice.org/en/project/english-dictionaries-apache-openoffice
build "en" "https://sourceforge.net/projects/aoo-extensions/files/17102/32/dict-en-20170101.oxt/download"
