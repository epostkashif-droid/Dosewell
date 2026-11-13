import org.objectweb.asm.*;
import java.nio.file.*;

/** Removes the MethodParameters attribute that newer javac versions add and the bundled d8 cannot read. */
public class StripParams {
    public static void main(String[] args) throws Exception {
        for (String a : args) {
            Path p = Paths.get(a);
            ClassReader r = new ClassReader(Files.readAllBytes(p));
            ClassWriter w = new ClassWriter(0);
            r.accept(new ClassVisitor(Opcodes.ASM7, w) {
                @Override public MethodVisitor visitMethod(int acc, String name, String desc, String sig, String[] ex) {
                    return new MethodVisitor(Opcodes.ASM7, super.visitMethod(acc, name, desc, sig, ex)) {
                        @Override public void visitParameter(String n, int access) { }
                    };
                }
            }, 0);
            Files.write(p, w.toByteArray());
        }
    }
}
