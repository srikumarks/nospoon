litsource = slang.js \
			slang_parse.js \
			slang_meta.js \
			slang_vocab.js \
			slang_objects.js \
			slang_concurrency.js \
			slang_the.js \
			slang_nondet.js \
			slang_fd.js \
			slang_error.js \
			slang_exports.js
libsource = slang_later.js
md_files = $(patsubst %.js,%.js.md,$(litsource))
docco_files = $(patsubst %.js,docs/%.html,$(litsource))
timestamp = "21 Feb 2017 - 26 Apr 2017"

all : slang_all.js slang.js.pdf $(md_files) $(docco_files)

%.js.md : %.js
	@echo Making $@
	@jdi $<
	@# Skip the last three lines where jdi inserts a "Generated at" footer.
	@# This screws up the files when concatenating the markdowns to make the
	@# final super-pdf.
	@cat $@ | ghead -n -3 > $@.tmp
	@mv $@.tmp $@

slang_all.js: $(litsource) $(libsource)
	cat $(litsource) $(libsource) > slang_all.js

slang.js.pdf: $(md_files)
	pandoc --toc -N \
		   --highlight-style=kate \
		   -M author="Srikumar K. S." \
		   -M title="The No Spoon Series : Building Slang" \
		   -M date=$(timestamp) \
		   -t latex -V geometry:margin=1in -f markdown $(md_files) --latex-engine=xelatex -o slang.js.pdf

docs/slang.html: $(litsource)
	docco $(litsource)

