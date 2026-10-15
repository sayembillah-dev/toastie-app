import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../core/theme/tokens.dart';
import 'icons.dart';
import 'widgets.dart';

class PickedPhoto {
  const PickedPhoto(this.bytes, this.mimeType);
  final Uint8List bytes;
  final String mimeType;
}

/// Camera / library sheet → a resized JPEG ready for `upload()`.
/// Returns null if cancelled. [onRemove] adds a "Remove photo" row.
Future<PickedPhoto?> pickPhoto(
  BuildContext context, {
  VoidCallback? onRemove,
  double maxSide = 1024,
}) async {
  ImageSource? source;
  await showActionSheet(context, actions: [
    SheetAction(icon: PhosphorIconsRegular.camera, label: 'Take a photo', onTap: () => source = ImageSource.camera),
    SheetAction(icon: PhosphorIconsRegular.image, label: 'Choose from library', onTap: () => source = ImageSource.gallery),
    if (onRemove != null)
      SheetAction(icon: PhosphorIconsRegular.trash, label: 'Remove photo', destructive: true, onTap: onRemove),
  ]);
  if (source == null) return null;
  try {
    final file = await ImagePicker().pickImage(
      source: source!,
      maxWidth: maxSide,
      maxHeight: maxSide,
      imageQuality: 85,
    );
    if (file == null) return null;
    final bytes = await file.readAsBytes();
    final mime = file.mimeType ??
        (file.name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');
    return PickedPhoto(bytes, mime);
  } catch (e) {
    if (context.mounted) showToast(context, 'Could not open the photo — check camera and photo permissions.', error: true);
    return null;
  }
}

/// Avatar with a camera badge; shows [pending] bytes, else [url], else initials.
class EditableAvatar extends StatelessWidget {
  const EditableAvatar({
    super.key,
    required this.name,
    this.url,
    this.pending,
    this.cleared = false,
    this.size = 88,
    required this.onTap,
  });
  final String name;
  final String? url;
  final Uint8List? pending;
  final bool cleared;
  final double size;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final Widget image = pending != null
        ? ClipOval(child: Image.memory(pending!, width: size, height: size, fit: BoxFit.cover))
        : Avatar(name: name, url: cleared ? null : url, size: size);
    return Semantics(
      button: true,
      label: 'Change photo',
      child: GestureDetector(
        onTap: onTap,
        child: Stack(children: [
          image,
          Positioned(
            right: 0,
            bottom: 0,
            child: Container(
              width: size * 0.34,
              height: size * 0.34,
              decoration: BoxDecoration(color: c.ink, shape: BoxShape.circle, border: Border.all(color: c.canvas, width: 2)),
              child: Icon(PhosphorIconsFill.camera, size: size * 0.17, color: c.canvas),
            ),
          ),
        ]),
      ),
    );
  }
}
